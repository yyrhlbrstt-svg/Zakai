/**
 * Tell an institution what is going wrong inside it, before a regulator does.
 *
 * WHAT THIS CHANGES ABOUT THE OFFER
 *
 * Everything on /institutions today argues that responding is cheaper than
 * ignoring — an ROI calculator, a cost-of-ignoring panel. That is a threat
 * dressed as a proposal, and a threat buys compliance at best, never adoption.
 * The actual offer it makes an institution is "a more efficient way to receive
 * complaints", which is not something any institution wants.
 *
 * The thing they do want is this. An institution's worst outcome is not a
 * complaint; it is a systemic fault a regulator finds after it has already hit
 * tens of thousands of customers, because remediation is then mandated across
 * all of them, with a fine and reporting on top.
 *
 * Institutions miss those faults for a structural reason: their complaint
 * systems handle complaints ONE AT A TIME, by design. Each is closed on its
 * own merits and nobody is looking across them. Zakai sits across many
 * customers of the same counterparty with documented outcomes, which is
 * precisely the view their own process cannot produce.
 *
 * THE LINE THIS MUST NOT CROSS
 *
 * An early warning buys an institution TIME TO FIX, never silence. The
 * regulatory snapshot publishes regardless, and nothing here is conditional on
 * payment or on a claim being dropped. The moment it becomes "pay us and we
 * won't report it" it is extortion, so this module reports the existence and
 * shape of a pattern — never an offer to suppress one, and never a claimant's
 * identity.
 *
 * Consumers are not traded away either: they are refunded either way. A
 * pattern fixed at source refunds everyone affected instead of only the few
 * who complained, which is the point.
 */

/** Same statistical gate used everywhere else a claim about a company is made. */
export const MIN_PATTERN_SAMPLE = 5;

/**
 * Share of an institution's claims that must share one cause before it is
 * called a pattern rather than a coincidence. Below this it is ordinary
 * complaint mix, and reporting it as systemic would be crying wolf at someone
 * we want to keep listening.
 */
export const PATTERN_MIN_SHARE = 0.3;

export interface ClaimRow {
  /** Normalised cause key — never free text from a user. */
  cause: string;
  /** Whether the institution ultimately paid. */
  paid: boolean;
  /** Recovered amount in minor units. */
  recoveredMinor: number;
  /** Days from delivery to resolution. */
  days: number;
}

export interface WarningPattern {
  cause: string;
  /** How many of this institution's claims share this cause. */
  count: number;
  /** Share of all claims against them, 0–1. */
  share: number;
  /** How often they paid on this cause — their own admission rate. */
  paidRate: number;
  /** Total already refunded on this cause, minor units. */
  refundedMinor: number;
  medianDays: number | null;
  /**
   * True when the institution paid most of the time. The strongest possible
   * signal that the underlying fault is real: they keep conceding it.
   */
  conceded: boolean;
}

export interface EarlyWarning {
  counterparty: string;
  totalClaims: number;
  patterns: WarningPattern[];
  /** Null when there is not enough evidence to tell them anything. */
  headline: WarningPattern | null;
  /** Why there is no headline, when there isn't. Shown, never hidden. */
  reason: "ok" | "too_few_claims" | "no_pattern";
}

export function buildEarlyWarning(
  counterparty: string,
  claims: readonly ClaimRow[],
): EarlyWarning {
  const totalClaims = claims.length;

  if (totalClaims < MIN_PATTERN_SAMPLE) {
    return { counterparty, totalClaims, patterns: [], headline: null, reason: "too_few_claims" };
  }

  const byCause = new Map<string, ClaimRow[]>();
  for (const c of claims) {
    const key = c.cause.trim().toLowerCase();
    if (!key) continue;
    const list = byCause.get(key);
    if (list) list.push(c);
    else byCause.set(key, [c]);
  }

  const patterns = [...byCause.entries()]
    .map(([cause, rows]) => patternFor(cause, rows, totalClaims))
    // Only causes that clear BOTH gates: enough rows to be real, and a large
    // enough share to be systemic rather than ordinary complaint mix.
    .filter((p) => p.count >= MIN_PATTERN_SAMPLE && p.share >= PATTERN_MIN_SHARE)
    .sort((a, b) => b.count - a.count || b.refundedMinor - a.refundedMinor);

  return {
    counterparty,
    totalClaims,
    patterns,
    headline: patterns[0] ?? null,
    reason: patterns.length > 0 ? "ok" : "no_pattern",
  };
}

function patternFor(cause: string, rows: readonly ClaimRow[], total: number): WarningPattern {
  const paid = rows.filter((r) => r.paid);
  const paidRate = paid.length / rows.length;
  const days = paid.map((r) => r.days).sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);

  return {
    cause,
    count: rows.length,
    share: rows.length / total,
    paidRate,
    // Integer minor units only.
    refundedMinor: paid.reduce((s, r) => s + Math.max(0, Math.round(r.recoveredMinor)), 0),
    medianDays:
      days.length === 0
        ? null
        : days.length % 2 === 1
          ? days[mid]
          : Math.round((days[mid - 1] + days[mid]) / 2),
    // Conceding more often than not is the institution's own evidence against
    // itself, and the reason this is worth their attention rather than ours.
    conceded: paidRate > 0.5,
  };
}

/**
 * Whether this warning is worth sending at all.
 *
 * A warning about a cause the institution rarely concedes is a disagreement,
 * not a fault, and sending it as one would spend the credibility that makes
 * the next warning land.
 */
export function worthWarning(warning: EarlyWarning): boolean {
  return warning.headline !== null && warning.headline.conceded;
}
