import { normalizeMerchant, type StatementTxn } from "@/lib/subscriptions";
import { CLAIM_SPEAK_THRESHOLD } from "@/lib/claimGate";

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
}

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
      const candidate: PriceIncrease = {
        merchant: list[cut].merchant,
        fromAgorot: from,
        toAgorot: to,
        deltaAgorot: delta,
        since: list[cut].date,
        observationsAtNewPrice: n,
        confidence,
        claimable: confidence >= CLAIM_SPEAK_THRESHOLD,
      };
      if (!best || candidate.deltaAgorot > best.deltaAgorot) best = candidate;
    }
    if (best) out.push(best);
  }

  out.sort((a, b) => b.deltaAgorot - a.deltaAgorot);
  return out;
}
