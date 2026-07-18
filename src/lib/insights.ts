/**
 * Rule-based insights — the assistant's deterministic core. Pure and fully
 * tested, so the assistant screen delivers real value even with no AI key
 * configured, and the LLM (when available) is additive, never load-bearing.
 *
 * Each insight is data (an i18n key + params + a deep link). The UI translates
 * and renders; nothing here executes anything — the agent proposes, the
 * existing gated flows execute.
 */

export interface CaseLite {
  status: string;
  amountOriginal: number; // agorot
  targetAmount: number; // agorot
  feeAgorot: number;
  savedMonthlyAgorot: number;
  /** Days since the saving was documented (settled cases only). */
  settledAgeDays?: number;
}

/** Promotional prices in Israeli telecom typically expire around here. */
export const RECHECK_AFTER_DAYS = 180;

export interface InsightInput {
  plan: "FREE" | "PRO" | "MAX";
  referralCreditAgorot: number;
  proPriceAgorot: number;
  cases: CaseLite[];
}

export interface Insight {
  /** i18n key under assistant.insights.* */
  key: string;
  /** Interpolation params (amounts pre-formatted by the UI). */
  params: Record<string, number>;
  /** Where the action happens (existing, gated flow). */
  href: string;
  /** Ordering weight — higher first. */
  weight: number;
}

export function computeInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const active = (s: string) => ["ANALYZED", "APPROVED", "VERIFIED", "SENT"].includes(s);

  // 1. A recommendation is waiting for the user's approval — the single most
  //    valuable nudge in the product (money already identified, one tap away).
  const waiting = input.cases.filter((c) => c.status === "ANALYZED" || c.status === "APPROVED");
  if (waiting.length > 0) {
    const potential = waiting.reduce(
      (s, c) => s + Math.max(0, c.amountOriginal - c.targetAmount),
      0,
    );
    out.push({ key: "pendingCase", params: { count: waiting.length, potential }, href: "/dashboard", weight: 100 });
  }

  // 2. Sent and awaiting the provider's reply — remind to record the outcome.
  const sent = input.cases.filter((c) => c.status === "SENT");
  if (sent.length > 0) {
    out.push({ key: "awaitingReply", params: { count: sent.length }, href: "/dashboard", weight: 80 });
  }

  // 3. No cases at all — the first check is the whole point.
  if (input.cases.length === 0) {
    out.push({ key: "firstCheck", params: {}, href: "/check", weight: 90 });
  }

  // 4. Fees paid on FREE exceed Pro's price — upgrading pays for itself.
  if (input.plan === "FREE") {
    const feesTotal = input.cases.reduce((s, c) => s + c.feeAgorot, 0);
    if (feesTotal > input.proPriceAgorot) {
      out.push({ key: "proPaysOff", params: { fees: feesTotal, price: input.proPriceAgorot }, href: "/pricing", weight: 70 });
    }
  }

  // 4.5 The retention engine's core nudge: a documented saving whose promo
  //     window has likely expired — prices creep back; time to re-check.
  const stale = input.cases.filter(
    (c) => c.status === "SAVED" && (c.settledAgeDays ?? 0) >= RECHECK_AFTER_DAYS,
  );
  if (stale.length > 0) {
    out.push({ key: "recheck", params: { count: stale.length }, href: "/check", weight: 85 });
  }

  // 5. Documented monthly savings so far — reinforce the outcome (trust loop).
  const savedMonthly = input.cases.reduce((s, c) => s + c.savedMonthlyAgorot, 0);
  if (savedMonthly > 0) {
    out.push({ key: "savedSoFar", params: { monthly: savedMonthly, yearly: savedMonthly * 12 }, href: "/dashboard", weight: 60 });
  }

  // 6. Nothing active and no referral credit — suggest inviting a friend.
  if (!input.cases.some((c) => active(c.status)) && input.referralCreditAgorot === 0) {
    out.push({ key: "invite", params: {}, href: "/settings", weight: 30 });
  }

  return out.sort((a, b) => b.weight - a.weight);
}
