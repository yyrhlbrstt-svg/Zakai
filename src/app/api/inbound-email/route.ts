import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractSavingsFromEmail } from "@/lib/ai";
import { sendEmail } from "@/lib/messaging";
import { pushToUser } from "@/lib/push";

/**
 * Inbound email webhook — the missing half of the closed-loop SavingsProof.
 *
 * Doctrine: no callback, no "leave phone". User (or provider) forwards a
 * confirmation / new bill / decision letter to a dedicated address
 * (e.g. proofs@zakai.example via Forward Email / Cloudflare Email Workers).
 * We extract the new monthly amount with AI, match the case by authorization
 * code (ZK-…) or principal email, and propose a record-saving for the user
 * to confirm in the dashboard. Never auto-charges; user remains the gate.
 *
 * Payload shape is deliberately simple so any forwarder can post JSON:
 *   { from, to, subject, text, html? }
 * Auth: optional shared secret in header X-Inbound-Secret when configured.
 */

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  from: z.string().email().or(z.string().min(3)),
  to: z.string().optional(),
  subject: z.string().default(""),
  text: z.string().default(""),
  html: z.string().optional(),
});

export async function POST(request: Request) {
  // Optional shared-secret gate (set INBOUND_EMAIL_SECRET in env).
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (expected) {
    const got = request.headers.get("x-inbound-secret") || "";
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const { from, subject, text, html } = parsed.data;
  const bodyText = [subject, text, html ?? ""].filter(Boolean).join("\n\n").slice(0, 12000);

  // 1. Extract candidate savings signal with AI (or deterministic fallback).
  let extract: Awaited<ReturnType<typeof extractSavingsFromEmail>>;
  try {
    extract = await extractSavingsFromEmail(bodyText);
  } catch {
    extract = { found: false, newAmountShekels: null, authorizationCode: null, confidence: 0, reason: "extract_failed" };
  }

  // 2. Match a Case.
  let matchedCaseId: string | null = null;
  let matchedUserId: string | null = null;

  if (extract.authorizationCode) {
    const auth = await prisma.authorization.findUnique({
      where: { code: extract.authorizationCode },
      include: { case: true },
    });
    if (auth && auth.status === "ACTIVE" && auth.case.status === "SENT") {
      matchedCaseId = auth.caseId;
      matchedUserId = auth.case.userId;
    }
  }

  // Fallback: match by principal email appearing in Authorization (masked public page still has full in DB).
  if (!matchedCaseId && from.includes("@")) {
    const authByEmail = await prisma.authorization.findFirst({
      where: {
        principalEmail: { equals: from, mode: "insensitive" },
        status: "ACTIVE",
        case: { status: "SENT" },
      },
      include: { case: true },
      orderBy: { issuedAt: "desc" },
    });
    if (authByEmail) {
      matchedCaseId = authByEmail.caseId;
      matchedUserId = authByEmail.case.userId;
    }
  }

  // 3. Persist a lightweight inbound log via Outbox.
  const note = JSON.stringify({
    direction: "inbound",
    from,
    subject,
    extract,
    matchedCaseId,
  });

  await prisma.outbox.create({
    data: {
      channel: "EMAIL",
      toAddress: from,
      subject: `[inbound] ${subject.slice(0, 120)}`,
      body: note,
      caseId: matchedCaseId ?? undefined,
      status: "QUEUED",
      providerMessageId: "inbound",
    },
  });

  // 4. If we have a solid match + amount, notify the user (email + push).
  if (
    matchedCaseId &&
    matchedUserId &&
    extract.found &&
    extract.newAmountShekels != null &&
    extract.confidence >= 0.6
  ) {
    const user = await prisma.user.findUnique({ where: { id: matchedUserId } });
    if (user?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-ecru.vercel.app";
      await sendEmail({
        to: user.email,
        subject: "זכאי — קיבלנו אישור חיסכון, אשר בלחיצה אחת",
        body: [
          `שלום ${user.name},`,
          ``,
          `קיבלנו הודעה שנראית כמו אישור חיסכון לתיק שלך.`,
          `סכום חודשי חדש שזוהה: ₪${extract.newAmountShekels}.`,
          ``,
          `כדי לסגור את התיק ולתעד את החיסכון (העמלה נגזרת רק אחרי אישור שלך):`,
          `${appUrl}/he/dashboard`,
          ``,
          `זכאי — סוכן כסף לצרכן.`,
        ].join("\n"),
        caseId: matchedCaseId,
      });

      await pushToUser(matchedUserId, {
        title: "זכאי — אישור חיסכון הגיע",
        body: `זוהה סכום חדש ₪${extract.newAmountShekels}. אשר בדשבורד בלחיצה אחת.`,
        url: "/he/dashboard",
        tag: `inbound-${matchedCaseId}`,
      }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    matched: Boolean(matchedCaseId),
    caseId: matchedCaseId,
    extract: {
      found: extract.found,
      newAmountShekels: extract.newAmountShekels,
      authorizationCode: extract.authorizationCode,
      confidence: extract.confidence,
    },
  });
}
