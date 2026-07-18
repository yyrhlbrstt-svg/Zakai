import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { askZakai, aiAvailable } from "@/lib/ai";
import { planConfig } from "@/lib/plans";
import { rateLimit, refundRateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  question: z.string().trim().min(2).max(1000),
  locale: z.string().default("he"),
});

/** Monthly question quota per plan (30-day fixed window). */
const QUOTA: Record<string, number> = { FREE: 5, PRO: 100, MAX: 300 };
const WINDOW_SECONDS = 30 * 24 * 3600;

/**
 * The assistant's ask endpoint. Control-plane separation: the model only ever
 * returns text; nothing here mutates state. Quotas are enforced per plan so
 * the free tier gets a real taste (5 questions/month) and Pro/Max get fair-use
 * allowances — the FinOps guardrail against runaway token spend.
 */
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

  // Compact snapshot of the user's own data — the ONLY data the model sees.
  const cases = await prisma.case.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      provider: true,
      status: true,
      amountOriginal: true,
      targetAmount: true,
      savingsProof: { select: { savingMonthly: true } },
      fee: { select: { amount: true, status: true } },
    },
  });
  const casesSummary =
    cases.length === 0
      ? "No checks yet."
      : cases
          .map(
            (c) =>
              `${c.provider}: status=${c.status}, pays ₪${(c.amountOriginal / 100).toFixed(0)}/mo, target ₪${(c.targetAmount / 100).toFixed(0)}` +
              (c.savingsProof ? `, documented saving ₪${(c.savingsProof.savingMonthly / 100).toFixed(0)}/mo` : "") +
              (c.fee ? `, fee ₪${(c.fee.amount / 100).toFixed(2)} (${c.fee.status})` : ""),
          )
          .join("\n");

  try {
    const answer = await askZakai(parsed.data.question, {
      plan,
      casesSummary,
      locale: parsed.data.locale,
    });
    return NextResponse.json({ answer });
  } catch (err) {
    // A failed model call must not burn the user's monthly question quota.
    await refundRateLimit("assistant", auth.userId, WINDOW_SECONDS);
    await reportError(err, { route: "assistant-ask" });
    return badRequest("aiUnavailable", 503);
  }
}
