import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { deliverOutboxRecord, outboxAsyncMode } from "@/lib/workers/outboxDeliver";

/**
 * Outbound messaging. Every message — email or SMS — is recorded in the Outbox
 * table. Real delivery is attempted only when a transport is configured
 * (SMTP_HOST for email, SMS_PROVIDER=http for SMS). Otherwise the message stays
 * in the Outbox and nothing leaves the system: the entire flow is testable in
 * dev without any external provider.
 *
 * Set OUTBOX_ASYNC=true to queue only; drain via GET /api/cron/outbox.
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function smsConfigured(): boolean {
  return process.env.SMS_PROVIDER === "http" && Boolean(process.env.SMS_HTTP_URL);
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

interface EmailArgs {
  to: string;
  subject: string;
  body: string;
  caseId?: string;
  attachments?: EmailAttachment[];
}

async function sendEmailWithAttachments(
  recordId: string,
  { to, subject, body, attachments }: EmailArgs,
) {
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
    to,
    subject,
    text: body,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || "text/html; charset=utf-8",
    })),
  });
  return prisma.outbox.update({
    where: { id: recordId },
    data: { status: "SENT", providerMessageId: info.messageId, sentAt: new Date() },
  });
}

export async function sendEmail({ to, subject, body, caseId, attachments }: EmailArgs) {
  const record = await prisma.outbox.create({
    data: { channel: "EMAIL", toAddress: to, subject, body, caseId, status: "QUEUED" },
  });

  if (!emailConfigured()) {
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "QUEUED", providerMessageId: "no-transport" },
    });
  }

  if (outboxAsyncMode()) {
    return record;
  }

  try {
    if (attachments?.length) {
      return await sendEmailWithAttachments(record.id, { to, subject, body, attachments });
    }
    const delivered = await deliverOutboxRecord(record);
    if (delivered === "sent" || delivered === "failed") {
      return prisma.outbox.findUniqueOrThrow({ where: { id: record.id } });
    }
    return record;
  } catch (err) {
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "FAILED", error: String(err) },
    });
  }
}

interface SmsArgs {
  to: string;
  body: string;
  caseId?: string;
}

export async function sendSms({ to, body, caseId }: SmsArgs) {
  const record = await prisma.outbox.create({
    data: { channel: "SMS", toAddress: to, body, caseId, status: "QUEUED" },
  });

  if (!smsConfigured()) {
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "QUEUED", providerMessageId: "no-transport" },
    });
  }

  if (outboxAsyncMode()) {
    return record;
  }

  const delivered = await deliverOutboxRecord(record);
  if (delivered === "sent" || delivered === "failed") {
    return prisma.outbox.findUniqueOrThrow({ where: { id: record.id } });
  }
  return record;
}
