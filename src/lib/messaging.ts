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

interface EmailArgs {
  to: string;
  subject: string;
  body: string;
  caseId?: string;
}

export async function sendEmail({ to, subject, body, caseId }: EmailArgs) {
  const record = await prisma.outbox.create({
    data: { channel: "EMAIL", toAddress: to, subject, body, caseId, status: "QUEUED" },
  });

  if (!emailConfigured()) {
    // Dev mode: leave it in the Outbox, delivered nowhere.
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "SENT", providerMessageId: "dev:outbox", sentAt: new Date() },
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
      from: process.env.SMTP_FROM || "Zakai <no-reply@zakai.example>",
      to,
      subject,
      text: body,
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
    return prisma.outbox.update({
      where: { id: record.id },
      data: { status: "SENT", providerMessageId: "dev:outbox", sentAt: new Date() },
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
