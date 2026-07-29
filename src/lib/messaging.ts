import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

/**
 * Outbound messaging. Every message — email or SMS — is recorded in the Outbox
 * table. Real delivery is attempted only when a transport is configured
 * (SMTP_HOST for email, SMS_PROVIDER=http for SMS). Otherwise the message stays
 * in the Outbox and nothing leaves the system: the entire flow is testable in
 * dev without any external provider.
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

export async function sendEmail({ to, subject, body, caseId, attachments }: EmailArgs) {
  const record = await prisma.outbox.create({
    data: { channel: "EMAIL", toAddress: to, subject, body, caseId, status: "QUEUED" },
  });

  if (!emailConfigured()) {
    // No transport: it stays in the Outbox and nothing leaves the system.
    //
    // Left QUEUED rather than marked SENT, and `sentAt` left null.
    //
    // Marking an undelivered message "sent" makes the ledger agree with the
    // optimistic reading of every dashboard built on top of it, and the first
    // person to notice is whoever was waiting for a reply that was never
    // posted. QUEUED already means exactly this — it has not left the system —
    // so the honest record needs no new status, only that we stop claiming the
    // wrong one. The marker says why, for whoever reads the row later.
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "QUEUED", providerMessageId: "no-transport" },
    });
  }

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
      // Falls back to the authenticated mailbox, never to an invented address.
      //
      // The previous default claimed to be no-reply@zakai.example — a domain
      // nobody controls. Mail sent that way fails SPF and DKIM, because the
      // sending server has no authority over the domain in the From header, and
      // Gmail responds exactly as it should: a red warning banner telling the
      // recipient the message may not be genuine, and in some cases a security
      // alert on their account.
      //
      // That is the report of "it says my account is not secure". It is not a
      // flaw in the app's authentication — it is us forging a sender. SMTP_USER
      // is the one address the transport can actually prove it may send as, so
      // it is the only safe fallback.
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
      where: { id: record.id },
      data: { status: "SENT", providerMessageId: info.messageId, sentAt: new Date() },
    });
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
    // Same correction as the email path: an undelivered message is not sent.
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "QUEUED", providerMessageId: "no-transport" },
    });
  }

  try {
    const res = await fetch(process.env.SMS_HTTP_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_HTTP_TOKEN
          ? { Authorization: `Bearer ${process.env.SMS_HTTP_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ to, message: body }),
    });
    if (!res.ok) throw new Error(`SMS gateway ${res.status}`);
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "SENT", providerMessageId: "http", sentAt: new Date() },
    });
  } catch (err) {
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "FAILED", error: String(err) },
    });
  }
}
