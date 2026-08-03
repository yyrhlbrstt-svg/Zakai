import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { askZakai, aiAvailable } from "@/lib/ai";
import { planConfig } from "@/lib/plans";
import { rateLimit, refundRateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { buildAssistantCasesSnapshot } from "@/lib/services/assistantContext";

const schema = z.object({
  question: z.string().trim().min(2).max(1000),
  locale: z.string().default("he"),
});

const QUOTA: Record<string, number> = { FREE: 5, PRO: 100, MAX: 300 };
const WINDOW_SECONDS = 30 * 24 * 3600;

const NEGOTIATION_COACH = `
CLOSURE COACH (revenue = completed loops):
- Always obey NEXT_ACTION in the snapshot. End with that one link only.
- Prefer written offers over phone-only deals so the saving can be documented.
- SENT + written result → Dashboard → Record saving (SavingsProof). No fee without this.
- SENT + silence → written follow-up with a short deadline (max ~4 rounds).
- PROPOSED_SAVING → /dashboard?case=<id> one-tap record. Never open a duplicate case.
- Pre-send Case → finish Mandate send before any new vertical.
- No open Case → /money only (not a menu of tools).
- Match the on-screen next-action panel when present — never invent a second plan.
- After SavingsProof only: suggest share. Never celebrate unverified amounts.
- Never promise a specific outcome. Never invent savings numbers. Never "we'll call you".
`.trim();

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  if (!aiAvailable()) return badRequest("aiUnavailable", 503);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { plan: true },
  });
  const plan = planConfig(user?.plan).id;

  const limited = await rateLimit("assistant", auth.userId, QUOTA[plan], WINDOW_SECONDS);
  if (!limited.ok) {
    return NextResponse.json({ error: "quotaExceeded", plan }, { status: 429 });
  }

  const casesSummary = `${await buildAssistantCasesSnapshot(auth.userId)}\n\n${NEGOTIATION_COACH}`;

  try {
    const answer = await askZakai(parsed.data.question, {
      plan,
      casesSummary,
      locale: parsed.data.locale,
    });
    return NextResponse.json({ answer });
  } catch (err) {
    await refundRateLimit("assistant", auth.userId, WINDOW_SECONDS);
    await reportError(err, { route: "assistant-ask" });
    return badRequest("aiUnavailable", 503);
  }
}
