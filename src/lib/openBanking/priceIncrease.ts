import { normalizeMerchant, type StatementTxn } from "@/lib/subscriptions";
import { decideClaim } from "@/lib/claimGate";

/**
 * A charge that went up and stayed up, found inside a single statement window.
 *
 * WHY THIS COULD NOT EXIST BEFORE OPEN BANKING
 *
 * `costDrift.ts` already answers "what changed since last time", but it needs
 * a baseline saved on a previous visit — which means the first visit can never
 * find anything, and most first visits are the only visit. A bank feed hands
 * us three months of history in one read, so the comparison that used to
 * require coming back twice is available immediately.
 *
 * That matters more in Israel than anywhere else this product runs: a package
 * price rising after a promotional period, without the notice the Consumer
 * Protection Law requires for a continuing transaction, is the single
 * best-documented consumer overcharge in this market. It is also invisible on
 * a statement, because no line item says "this went up" — you only see it by
 * putting April beside June, which nobody does.
 *
 * MIRROR VERSUS CLAIM, AGAIN
 *
 * "Your bill went from ₪89.90 to ₪119.90" is arithmetic over the person's own
 * data. It is a mirror, it is either true or false, and it needs no
 * permission to be shown. "You are owed that difference back" is a claim about
 * money and goes through the gate. So this module reports the fact always, and
 * marks separately whether the evidence is strong enough to assert anything.
 *
 * One observation at the higher price is genuinely not proof of a new price —
 * it could be one month with an extra charge on it. That is why `confidence`
 * climbs with how many times the new price repeats, and why a single sighting
 * lands below the speaking threshold by construction.
 *
 * WHY THE VERDICT COMES FROM THE GATE RATHER THAN A COMPARISON HERE
 *
 * The first version of this file compared `confidence >= CLAIM_SPEAK_THRESHOLD`
 * itself. That reproduced one third of the rule and quietly dropped the rest:
 * the gate also requires an immediate way to act, and a claim with nowhere to
 * go is unfalsifiable by construction — it never becomes a case, so nothing
 * ever tells us whether we were right. Two implementations of one rule is one
 * implementation and one bug waiting for the rule to change, so this calls
 * `decideClaim` like every other surface does.
 */

export interface PriceIncrease {
  merchant: string;
  /** The settled earlier price, integer agorot. */
  fromAgorot: number;
  /** The settled later price, integer agorot. */
  toAgorot: number;
  /** toAgorot - fromAgorot, always positive. */
  deltaAgorot: number;
  /** When the higher price first appears. */
  since: Date;
  /** How many charges were seen at the new price. */
  observationsAtNewPrice: number;
  /** 0..1. Below CLAIM_SPEAK_THRESHOLD this is a fact, not a claim. */
  confidence: number;
  /** True when the evidence supports asserting it, not merely showing it. */
  claimable: boolean;
  /** Where a person goes to act on it. Present whether or not it is claimable:
   *  the route exists either way, and only the assertion is gated. */
  actionHref: string;
}

/**
 * Where somebody goes when told their price went up.
 *
 * The negotiation tool, which is a real next step for exactly this: a package
 * that quietly rose after a promotional period is the case it was built for.
 * Deliberately NOT a new legal claim — the statutory angle on unnotified
 * increases is real but unverified in this repo, and the rights graph refuses
 * draft law by design. An action grounded in a tool we already ship needs no
 * citation to be honest.
 */
export const PRICE_RISE_ACTION = "/check";

/** Ignore rounding noise and trivial drift: a real rise is both. */
const MIN_DELTA_AGOROT = 500; // ₪5
const MIN_DELTA_RATIO = 0.05; // 5%

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function detectPriceIncreases(txns: readonly StatementTxn[]): PriceIncrease[] {
  const groups = new Map<string, StatementTxn[]>();
  for (const t of txns) {
    const key = normalizeMerchant(t.merchant);
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const out: PriceIncrease[] = [];
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    list.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find the split that best separates a lower earlier price from a higher
    // later one. Every split is tried rather than assuming the change happened
    // in the middle; a rise in the final month is the common case.
    let best: PriceIncrease | null = null;
    for (let cut = 1; cut < list.length; cut++) {
      const before = list.slice(0, cut).map((t) => t.amountAgorot);
      const after = list.slice(cut).map((t) => t.amountAgorot);
      const from = median(before);
      const to = median(after);
      const delta = to - from;
      if (delta < MIN_DELTA_AGOROT) continue;
      if (from <= 0 || delta / from < MIN_DELTA_RATIO) continue;
      // Every later charge must actually be above every earlier one, or this
      // is noise around a mean rather than a step.
      if (Math.min(...after) <= Math.max(...before)) continue;

      // Confidence rises with repetition of the NEW price: one sighting is a
      // month with something extra on it, three is a tariff.
      const n = after.length;
      const confidence = Number(Math.min(1, 0.45 + (n - 1) * 0.25).toFixed(3));
      // No right is consulted: this is arithmetic over the person's own
      // statement, and saying so honestly is better than borrowing the
      // authority of a statute we have not verified.
      const verdict = decideClaim(
        {
          kind: "price_increase",
          confidence,
          rightId: null,
          actionHref: PRICE_RISE_ACTION,
          estimatedValueAgorot: delta,
        },
        () => true,
      );
      const candidate: PriceIncrease = {
        merchant: list[cut].merchant,
        fromAgorot: from,
        toAgorot: to,
        deltaAgorot: delta,
        since: list[cut].date,
        observationsAtNewPrice: n,
        confidence,
        claimable: verdict.speak,
        actionHref: PRICE_RISE_ACTION,
      };
      if (!best || candidate.deltaAgorot > best.deltaAgorot) best = candidate;
    }
    if (best) out.push(best);
  }

  out.sort((a, b) => b.deltaAgorot - a.deltaAgorot);
  return out;
}
