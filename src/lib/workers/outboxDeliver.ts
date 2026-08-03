import "server-only";

import nodemailer from "nodemailer";
import type { Outbox } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const OUTBOX_WORKER_BATCH_DEFAULT = 25;

export function outboxAsyncMode(): boolean {
  return process.env.OUTBOX_ASYNC === "true";
}

function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
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
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost",
      to: record.toAddress,
      subject: record.subject,
      text: record.body,
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
    await prisma.outbox.update({
      where: { id: record.id },
      data: { status: "FAILED", error: String(err) },
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
    await prisma.outbox.update({
      where: { id: record.id },
      data: { status: "FAILED", error: String(err) },
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
}

/**
 * Drain QUEUED and retry FAILED rows. Class D worker — /api/cron/outbox.
 */
export async function processOutboxBatch(limit = OUTBOX_WORKER_BATCH_DEFAULT): Promise<OutboxWorkerResult> {
  const result: OutboxWorkerResult = { scanned: 0, sent: 0, failed: 0, skipped: 0 };

  const rows = await prisma.outbox.findMany({
    where: { status: { in: ["QUEUED", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of rows) {
    result.scanned += 1;
    if (row.status === "FAILED") {
      await prisma.outbox.update({
        where: { id: row.id },
        data: { status: "QUEUED", error: null },
      });
    }
    const fresh = await prisma.outbox.findUnique({ where: { id: row.id } });
    if (!fresh) continue;
    const outcome = await deliverOutboxRecord(fresh);
    if (outcome === "sent") result.sent += 1;
    else if (outcome === "failed") result.failed += 1;
    else result.skipped += 1;
  }

  return result;
}
