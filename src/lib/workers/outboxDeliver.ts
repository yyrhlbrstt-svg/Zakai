import "server-only";

import nodemailer from "nodemailer";
import type { Outbox } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rebuildMandateAttachmentsForCase,
  shouldAttachMandateDocs,
} from "@/lib/services/outreachAttachments";
import {
  formatOutboxFailure,
  isOutboxDeadLetter,
  MAX_OUTBOX_ATTEMPTS,
  parseOutboxAttempts,
} from "@/lib/workers/outboxRetry";
import { proofsInboundAddress } from "@/lib/mandate/document";
import { smtpFullyConfigured } from "@/lib/deploy/smtpConfigured";

export const OUTBOX_WORKER_BATCH_DEFAULT = 25;

export function outboxAsyncMode(): boolean {
  return process.env.OUTBOX_ASYNC === "true";
}

function emailConfigured(): boolean {
  return smtpFullyConfigured();
}

function smsConfigured(): boolean {
  return process.env.SMS_PROVIDER === "http" && Boolean(process.env.SMS_HTTP_URL);
}

async function deliverEmailRecord(record: Outbox): Promise<"sent" | "failed" | "skipped"> {
  if (!emailConfigured()) return "skipped";
  if (!record.subject) return "failed";

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    // Outbox does not persist attachments. Rebuild Mandate docs for provider
    // outreach so async drain matches the sync sendEmail path.
    let attachments:
      | { filename: string; content: string | Buffer; contentType: string }[]
      | undefined;
    if (record.caseId && shouldAttachMandateDocs(record.subject)) {
      const rebuilt = await rebuildMandateAttachmentsForCase(record.caseId);
      if (rebuilt.length === 0) {
        // Fail closed: never send provider outreach as body-only pretending
        // Mandate docs were attached (async path used to do exactly that).
        const attempts = parseOutboxAttempts(record.error) + 1;
        await prisma.outbox.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            error: formatOutboxFailure(attempts, "mandate_attachments_unavailable"),
          },
        });
        return "failed";
      }
      attachments = rebuilt.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "text/html; charset=utf-8",
      }));
    }

    const proofsReply = proofsInboundAddress().trim();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost",
      to: record.toAddress,
      subject: record.subject,
      text: record.body,
      replyTo: proofsReply.includes("@") ? proofsReply : undefined,
      attachments,
    });
    await prisma.outbox.update({
      where: { id: record.id },
      data: {
        status: "SENT",
        providerMessageId: info.messageId,
        sentAt: new Date(),
        error: null,
      },
    });
    return "sent";
  } catch (err) {
    const attempts = parseOutboxAttempts(record.error) + 1;
    await prisma.outbox.update({
      where: { id: record.id },
      data: { status: "FAILED", error: formatOutboxFailure(attempts, String(err)) },
    });
    return "failed";
  }
}

async function deliverSmsRecord(record: Outbox): Promise<"sent" | "failed" | "skipped"> {
  if (!smsConfigured()) return "skipped";

  try {
    const res = await fetch(process.env.SMS_HTTP_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_HTTP_TOKEN
          ? { Authorization: `Bearer ${process.env.SMS_HTTP_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ to: record.toAddress, message: record.body }),
    });
    if (!res.ok) throw new Error(`SMS gateway ${res.status}`);
    await prisma.outbox.update({
      where: { id: record.id },
      data: { status: "SENT", providerMessageId: "http", sentAt: new Date(), error: null },
    });
    return "sent";
  } catch (err) {
    const attempts = parseOutboxAttempts(record.error) + 1;
    await prisma.outbox.update({
      where: { id: record.id },
      data: { status: "FAILED", error: formatOutboxFailure(attempts, String(err)) },
    });
    return "failed";
  }
}

/** Deliver one outbox row when transport is configured. */
export async function deliverOutboxRecord(record: Outbox): Promise<"sent" | "failed" | "skipped"> {
  if (record.channel === "EMAIL") return deliverEmailRecord(record);
  if (record.channel === "SMS") return deliverSmsRecord(record);
  return "skipped";
}

export interface OutboxWorkerResult {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Provider outreach that left — user notify upgrades attempted (best-effort). */
  notifiedDelivered: number;
}

/**
 * Drain QUEUED and retry FAILED rows. Class D worker — /api/cron/outbox.
 * FAILED rows that hit MAX_OUTBOX_ATTEMPTS stay dead-lettered (no retry storm).
 *
 * When a provider Mandate letter finally SENT after async queue, upgrade the
 * consumer from "בתור שליחה" / silence → honest "נשלח" (sync path already does).
 */
export async function processOutboxBatch(limit = OUTBOX_WORKER_BATCH_DEFAULT): Promise<OutboxWorkerResult> {
  const result: OutboxWorkerResult = {
    scanned: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    notifiedDelivered: 0,
  };
  const smtpUp = emailConfigured();

  const rows = await prisma.outbox.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED"] },
      AND: [
        { NOT: { error: { startsWith: "[dead-letter]" } } },
        // Keep no-transport rows parked until SMTP exists; otherwise every tick
        // would "skip" them forever and crowd out real work.
        ...(smtpUp ? [] : [{ NOT: { providerMessageId: "no-transport" } }]),
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of rows) {
    result.scanned += 1;
    if (row.status === "FAILED") {
      if (isOutboxDeadLetter(row.error) || parseOutboxAttempts(row.error) >= MAX_OUTBOX_ATTEMPTS) {
        if (!isOutboxDeadLetter(row.error)) {
          await prisma.outbox.update({
            where: { id: row.id },
            data: {
              error: formatOutboxFailure(MAX_OUTBOX_ATTEMPTS, row.error || "max attempts"),
            },
          });
        }
        result.skipped += 1;
        continue;
      }
      // Preserve attempt marker while re-queuing (do not wipe error to null).
      await prisma.outbox.update({
        where: { id: row.id },
        data: {
          status: "QUEUED",
          error: `[attempts=${parseOutboxAttempts(row.error)}]`,
        },
      });
    }
    const fresh = await prisma.outbox.findUnique({ where: { id: row.id } });
    if (!fresh) continue;
    const outcome = await deliverOutboxRecord(fresh);
    if (outcome === "sent") {
      result.sent += 1;
      // Dynamic import: messaging → outboxDeliver; notify → messaging.
      if (fresh.channel === "EMAIL" && fresh.caseId) {
        try {
          const { notifyUserProviderOutreachDelivered } = await import(
            "@/lib/services/outreachDeliveredNotify"
          );
          const notified = await notifyUserProviderOutreachDelivered(
            fresh.caseId,
            fresh.subject,
          );
          if (notified) result.notifiedDelivered += 1;
        } catch {
          // Delivery already committed; notify is best-effort honesty upgrade.
        }
      }
    } else if (outcome === "failed") result.failed += 1;
    else result.skipped += 1;
  }

  return result;
}
