import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot } from "@/lib/money";
import { findDuplicateReceipt, receiptsToCsv, type ReceiptLike } from "@/lib/receipts";
import type { ReceiptAnalysis } from "@/lib/ai";

export interface RecordedReceipt {
  id: string;
  vendor: string;
  amountAgorot: number;
  currency: string;
  occurredAt: Date | null;
  category: string;
  hasVat: boolean;
  flagged: boolean;
  duplicateOfId: string | null;
  createdAt: Date;
}

const RECENT_WINDOW_DAYS = 90;

/**
 * Persist a scanned receipt and check it against the user's recent receipts
 * for a duplicate charge. Only ever flags — never opens a Case on its own;
 * the user still reviews and approves before anything is sent, same as
 * every other vertical in this codebase.
 */
export async function recordReceipt(
  userId: string,
  analysis: ReceiptAnalysis,
  source: "photo" | "email" | "whatsapp" = "photo",
): Promise<RecordedReceipt> {
  const occurredAt = analysis.date ? new Date(analysis.date) : null;
  const amountAgorot = shekelsToAgorot(analysis.amountShekels);
  const detectionTimestamp = occurredAt && !isNaN(occurredAt.getTime()) ? occurredAt : new Date();

  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await prisma.receipt.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { id: true, vendor: true, amountAgorot: true, occurredAt: true, createdAt: true },
  });
  const existing: ReceiptLike[] = recent.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    amountAgorot: r.amountAgorot,
    occurredAt: r.occurredAt ?? r.createdAt,
  }));

  const duplicate = findDuplicateReceipt(
    { vendor: analysis.vendor, amountAgorot, occurredAt: detectionTimestamp },
    existing,
  );

  const created = await prisma.receipt.create({
    data: {
      userId,
      vendor: analysis.vendor,
      amountAgorot,
      currency: analysis.currency,
      occurredAt,
      category: analysis.category,
      hasVat: analysis.hasVat,
      source,
      duplicateOfId: duplicate?.id ?? null,
      flaggedAt: duplicate ? new Date() : null,
    },
  });

  return {
    id: created.id,
    vendor: created.vendor,
    amountAgorot: created.amountAgorot,
    currency: created.currency,
    occurredAt: created.occurredAt,
    category: created.category,
    hasVat: created.hasVat,
    flagged: Boolean(created.duplicateOfId),
    duplicateOfId: created.duplicateOfId,
    createdAt: created.createdAt,
  };
}

export async function listReceipts(userId: string, take = 100): Promise<RecordedReceipt[]> {
  const rows = await prisma.receipt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    amountAgorot: r.amountAgorot,
    currency: r.currency,
    occurredAt: r.occurredAt,
    category: r.category,
    hasVat: r.hasVat,
    flagged: Boolean(r.duplicateOfId),
    duplicateOfId: r.duplicateOfId,
    createdAt: r.createdAt,
  }));
}

export async function exportReceiptsCsv(userId: string): Promise<string> {
  const rows = await prisma.receipt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return receiptsToCsv(
    rows.map((r) => ({
      vendor: r.vendor,
      amountAgorot: r.amountAgorot,
      currency: r.currency,
      occurredAt: r.occurredAt,
      category: r.category,
      hasVat: r.hasVat,
      flaggedAt: r.flaggedAt,
    })),
  );
}

/**
 * Record interest in automatic Gmail/Outlook scanning. Not a live
 * connection — see ConnectedInboxInterest in schema.prisma for why.
 */
export async function recordInboxInterest(
  userId: string,
  provider: "gmail" | "outlook",
): Promise<void> {
  await prisma.connectedInboxInterest.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider },
    update: {},
  });
}
