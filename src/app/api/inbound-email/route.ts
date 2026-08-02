import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractSavingsFromEmail } from "@/lib/ai";
import { sendEmail } from "@/lib/messaging";
import { pushToUser } from "@/lib/push";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { secretsMatch } from "@/lib/security/timingSafe";
import { shouldNotifyInbound } from "@/lib/inboundDecision";
import { inboundProposedRemainingShekels } from "@/lib/fee";
import { feeBasisForVertical } from "@/lib/verticals";

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
 * Rate limits: 60/hour per IP, 20/hour per from-address (abuse protection).
 */

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  from: z.string().email().or(z.string().min(3).max(320)),
  to: z.string().max(320).optional(),
  subject: z.string().max(500).default(""),
  text: z.string().max(50_000).default(""),
  html: z.string().max(100_000).optional(),
});

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
}

export async function POST(request: Request) {
  const started = Date.now();
  const ip = clientIp(request);

  // Optional shared-secret gate (set INBOUND_EMAIL_SECRET in env).
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (expected) {
    const got = request.headers.get("x-inbound-secret") || "";
    if (!secretsMatch(got, expected)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  // Rate limit by connecting IP (platform-set, not spoofable left-most XFF).
  const ipLimit = await rateLimit("inbound-email-ip", ip, 60, 3600);
  if (!ipLimit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const { from, subject, text, html } = parsed.data;

  // Secondary limit by sender address (stops a single mailbox flooding us).
  const fromKey = from.toLowerCase().slice(0, 160);
  const fromLimit = await rateLimit("inbound-email-from", fromKey, 20, 3600);
  if (!fromLimit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const bodyText = [subject, text, html ?? ""].filter(Boolean).join("\n\n").slice(0, 12000);

  // 1. Extract candidate savings signal with AI (or deterministic fallback).
  let extract: Awaited<ReturnType<typeof extractSavingsFromEmail>>;
  try {
    extract = await extractSavingsFromEmail(bodyText);
  } catch (err) {
    await reportError(err, { route: "inbound-email-extract", ip }).catch(() => null);
    extract = {
      found: false,
      newAmountShekels: null,
      authorizationCode: null,
      confidence: 0,
      reason: "extract_failed",
    };
  }

  // Also try to pull an authorization code from subject/body if AI missed it.
  if (!extract.authorizationCode) {
    const codeMatch = bodyText.match(/\b(ZK-[A-Z0-9]{4,16})\b/i);
    if (codeMatch) {
      extract = { ...extract, authorizationCode: codeMatch[1].toUpperCase() };
    }
  }

  // 2. Match a Case.
  let matchedCaseId: string | null = null;
  let matchedUserId: string | null = null;
  let matchMethod: "code" | "email" | null = null;

  if (extract.authorizationCode) {
    const auth = await prisma.authorization.findUnique({
      where: { code: extract.authorizationCode },
      include: { case: true },
    });
    if (auth && auth.status === "ACTIVE" && auth.case.status === "SENT") {
      matchedCaseId = auth.caseId;
      matchedUserId = auth.case.userId;
      matchMethod = "code";
    }
  }

  // Fallback: match by principal email on ACTIVE authorization for a SENT case.
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
      matchMethod = "email";
    }
  }

  // 3. Persist a structured inbound log via Outbox (audit + proposed-saving source).
  const note = JSON.stringify({
    direction: "inbound",
    from,
    subject,
    extract,
    matchedCaseId,
    matchMethod,
    ip,
    ms: Date.now() - started,
  });

  await prisma.outbox.create({
    data: {
      channel: "EMAIL",
      toAddress: from.slice(0, 320),
      subject: `[inbound] ${subject.slice(0, 120)}`,
      body: note,
      caseId: matchedCaseId ?? undefined,
      status: "QUEUED",
      providerMessageId: "inbound",
    },
  });

  // 4. If we have a solid match + amount, notify the user (email + push).
  // "Solid" is defined by shouldNotifyInbound: an exact ZK-code match is
  // always solid; a fuzzy sender-email match additionally needs extractor
  // confidence. See inboundDecision.ts for why the two are gated differently.
  let notified = false;
  if (
    matchedCaseId &&
    matchedUserId &&
    shouldNotifyInbound({
      matchMethod,
      found: extract.found,
      newAmountShekels: extract.newAmountShekels,
      confidence: extract.confidence,
    })
  ) {
    const user = await prisma.user.findUnique({ where: { id: matchedUserId } });
    const kase = await prisma.case.findUnique({
      where: { id: matchedCaseId },
      select: { vertical: true, amountOriginal: true },
    });
    if (user?.email && kase && extract.newAmountShekels != null) {
      const appUrl = appBaseUrl();
      const basis = feeBasisForVertical(kase.vertical);
      const originalShekels = Math.round(kase.amountOriginal / 100);
      const recordShekels = inboundProposedRemainingShekels(
        basis,
        originalShekels,
        extract.newAmountShekels,
      );
      const amountLine =
        basis === "lump"
          ? recordShekels === 0
            ? `זוהה אישור על החזר/תשלום — ניתן לרשום התקבל במלואו (נותר ₪0).`
            : `זוהה סכום שקשור להחזר — נותר לשלם בערך ₪${recordShekels} (אשר בדשבורד).`
          : `סכום חודשי חדש שזוהה: ₪${recordShekels}.`;
      const pushBody =
        basis === "lump"
          ? recordShekels === 0
            ? "זוהה אישור החזר במלואו. אשר בדשבורד בלחיצה אחת."
            : `נותר לשלם בערך ₪${recordShekels}. אשר בדשבורד.`
          : `זוהה סכום חדש ₪${recordShekels}. אשר בדשבורד בלחיצה אחת.`;

      await sendEmail({
        to: user.email,
        subject: "זכאי — קיבלנו אישור חיסכון, אשר בלחיצה אחת",
        body: [
          `שלום ${user.name},`,
          ``,
          `קיבלנו הודעה שנראית כמו אישור חיסכון לתיק שלך.`,
          amountLine,
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
        body: pushBody,
        url: "/he/dashboard",
        tag: `inbound-${matchedCaseId}`,
      }).catch(() => null);

      notified = true;
    }
  }

  return NextResponse.json({
    ok: true,
    matched: Boolean(matchedCaseId),
    caseId: matchedCaseId,
    matchMethod,
    notified,
    extract: {
      found: extract.found,
      newAmountShekels: extract.newAmountShekels,
      authorizationCode: extract.authorizationCode,
      confidence: extract.confidence,
      reason: extract.reason,
    },
    ms: Date.now() - started,
  });
}
