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

const QUOTA: Record<string, number> = { FREE: 5, PRO: 100, MAX: 300 };
const WINDOW_SECONDS = 30 * 24 * 3600;

const NEGOTIATION_COACH = `
NEGOTIATION COACHING (use when the user has SENT cases or asks how to lower a price):
- Prefer written offers over phone-only deals so the saving can be documented.
- If the provider refused: ask for a short written reason + any retention options.
- If the offer is too low: thank them and request a bridge toward the target amount.
- If no reply: send a polite written reminder with a 5 business-day ask.
- After any new price: tell the user to open Dashboard → enter the new monthly amount → Record saving.
- Screens: /dashboard (follow-up + record), /money (see charges), /check (new case).
- Never promise a specific outcome. Never invent savings numbers.
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

  const sentCount = cases.filter((c) => c.status === "SENT").length;
  const casesSummary =
    cases.length === 0
      ? "No checks yet. Suggest /money or /check as first step."
      : cases
          .map(
            (c) =>
              `${c.provider}: status=${c.status}, pays ₪${(c.amountOriginal / 100).toFixed(0)}/mo, target ₪${(c.targetAmount / 100).toFixed(0)}` +
              (c.savingsProof
                ? `, documented saving ₪${(c.savingsProof.savingMonthly / 100).toFixed(0)}/mo`
                : "") +
              (c.fee ? `, fee ₪${(c.fee.amount / 100).toFixed(2)} (${c.fee.status})` : ""),
          )
          .join("\n") +
        (sentCount > 0
          ? `\n\n${sentCount} case(s) awaiting provider reply — user can draft follow-ups on /dashboard.`
          : "") +
        `\n\n${NEGOTIATION_COACH}`;

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
