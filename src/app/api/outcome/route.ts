import { NextResponse } from "next/server";
import { z } from "zod";
import { recordSelfReport } from "@/lib/strategy/store";
import { recordSelfReportedSaving } from "@/lib/services/selfReportedSaving";
import { getSessionUserId } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "What happened after you sent it?"
 *
 * WHY THIS TAKES NO AUTHENTICATION
 *
 * Requiring an account is precisely the gate that kept the outcome graph empty.
 * Most of this product works without one — the letters are generated on the
 * person's own device and never reach us — so a report that demanded a login
 * would be asking for a signup in exchange for helping us, which is a trade
 * nobody takes.
 *
 * That is safe here only because the payload cannot identify anybody. Every
 * field is drawn from a closed set the client cannot extend, there is no user or
 * case reference, and the amount is coarse. The worst an abusive caller can do
 * is add noise to a ranking, which the rate limit bounds and which is a
 * different order of problem from leaking who is claiming what.
 *
 * WHAT IS DELIBERATELY NOT ACCEPTED
 *
 * Free text, anywhere. A counterparty is a key from a closed list rather than a
 * name, because a free-text field in a de-identified table is a place somebody
 * eventually types a person's name and nobody notices for a year.
 */

/** Coarse buckets. Enough to learn from, too blunt to single anybody out. */
const AMOUNT_BANDS: Record<string, number> = {
  none: 0,
  under_100: 5_000,
  under_1k: 50_000,
  under_10k: 500_000,
  over_10k: 2_000_000,
};

const schema = z.object({
  // ISO-3166 alpha-2. A market we do not run in is a typo or a probe.
  market: z.string().length(2).regex(/^[A-Z]{2}$/),
  // Which of our paths produced the letter. Closed set, never free text.
  vertical: z.string().min(2).max(40).regex(/^[a-z0-9_:-]+$/),
  counterparty: z.string().min(2).max(60).regex(/^[a-z0-9_:-]+$/),
  variantId: z.string().min(2).max(60).regex(/^[a-z0-9_:-]+$/),
  paid: z.boolean(),
  amountBand: z.enum(["none", "under_100", "under_1k", "under_10k", "over_10k"]),
  // Send to answer. Bounded at three years: anything longer is a typo, and an
  // outlier here would distort the median for everybody.
  days: z.number().int().min(0).max(1095),
});

export async function POST(request: Request) {
  // Generous, because a person reporting several letters in one sitting is the
  // behaviour we want, and tight, because this writes to the asset the whole
  // product's judgement is built on.
  const limited = await rateLimit("outcome_report", clientIp(request), 30, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { market, vertical, counterparty, variantId, paid, amountBand, days } = parsed.data;

  // A report of "paid" with no amount, or "not paid" with one, is internally
  // inconsistent. Rejecting rather than guessing: a row we had to interpret is
  // a row we cannot trust later, and this table is meant to outlive the
  // reasoning that wrote it.
  if (paid && amountBand === "none") {
    return NextResponse.json({ error: "inconsistent" }, { status: 400 });
  }
  if (!paid && amountBand !== "none") {
    return NextResponse.json({ error: "inconsistent" }, { status: 400 });
  }

  try {
    await recordSelfReport({
      context: { market, vertical, counterparty },
      variantId,
      paid,
      recoveredMinor: AMOUNT_BANDS[amountBand],
      days,
    });

    // And, for somebody with an account, a proof of their own.
    //
    // The de-identified row above is the moat; this is the loop. Six engines
    // produce letters and none of them could produce a SavingsProof, so the
    // wall stayed empty and a person's own record showed nothing however well
    // the letter worked. It creates no Fee — eighteen percent of a number
    // somebody typed is not a fee this company could defend — and it is marked,
    // because a wall that blends documented outcomes with remembered ones is a
    // fabricated traction metric wearing a receipt.
    //
    // Anonymous reporters get the graph row and nothing else, which is the
    // correct consequence of having kept their letters on their own device.
    if (paid) {
      const userId = await getSessionUserId().catch(() => null);
      if (userId) {
        await recordSelfReportedSaving({
          userId,
          vertical,
          provider: counterparty,
          recoveredMinor: AMOUNT_BANDS[amountBand],
          reference: variantId,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "outcome" });
    // The report is a gift; a failure to store it is our problem, not theirs,
    // and must never present as something they did wrong.
    return NextResponse.json({ ok: true });
  }
}
