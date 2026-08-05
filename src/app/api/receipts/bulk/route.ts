import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plans";
import { parseStatement } from "@/lib/subscriptions";
import { recordReceiptsBulk } from "@/lib/services/receipts";
import { rateLimit } from "@/lib/ratelimit";

/** A full year of vendor invoices, generously; not an unbounded upload. */
const MAX_CSV_CHARS = 2_000_000;

const schema = z.object({
  csv: z.string().min(1).max(MAX_CSV_CHARS),
});

/**
 * Business-tier only: a full CSV of vendor charges, swept for duplicates in
 * one pass instead of one photo at a time. Gated server-side (not just in
 * the UI) because, unlike the browser-only recurring-charge scan, this
 * writes up to MAX_BULK_ROWS receipt rows per call — a real backend cost
 * the Business plan is what pays for.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
  if (planConfig(user?.plan).id !== "BUSINESS") {
    return NextResponse.json({ error: "businessPlanRequired" }, { status: 403 });
  }

  const limited = await rateLimit("receipts-bulk", auth.userId, 10, 24 * 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const txns = parseStatement(parsed.data.csv);
  if (txns.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, flagged: [] });
  }

  const result = await recordReceiptsBulk(auth.userId, txns);
  return NextResponse.json(result);
}
