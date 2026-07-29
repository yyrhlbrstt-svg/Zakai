/**
 * From "I tore my cruciate ligament playing football" to every payer at once.
 *
 * THE ORDERING PROBLEM, AND WHY IT IS NOT "BIGGEST FIRST"
 *
 * The obvious ranking is by expected money, and it is wrong. The largest payer
 * in this category — National Insurance for a work or commuting accident — also
 * has the shortest window, twelve months, while a road-accident claim under
 * absolute liability runs for seven years. Sorting by size tells somebody to
 * spend their attention on the claim that will still be there in 2033 and to
 * discover in month thirteen that the other one is gone.
 *
 * So the ranking is by what expires soonest among the things that apply, which
 * is the only ordering that cannot cost anybody money. Where no date was given
 * the window is shown as a period rather than a countdown, because a deadline
 * we cannot actually compute must not be drawn as one.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not tell anybody they are insured. Every result is a payer the person
 * plausibly has a claim against, with the reason to believe so stated in the
 * open so they can disagree with it. Being wrong about somebody's cover in the
 * confident direction is the failure mode that would end this feature.
 */

import { IL_COVER_SOURCES, type CoverSource, type IncidentFacts } from "./sources";

export interface CoverMatch {
  source: CoverSource;
  /** Days left to claim, when we know the date and the window. */
  daysLeft: number | null;
  /** The date the claim window shuts, when computable. */
  closesAt: Date | null;
  urgency: "critical" | "soon" | "ample" | "unknown" | "expired";
  /**
   * True when claiming here does not reduce anything claimable elsewhere.
   * The single most valuable thing this module tells anybody.
   */
  stacks: boolean;
}

const DAY = 86_400_000;

function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function urgencyOf(daysLeft: number | null): CoverMatch["urgency"] {
  if (daysLeft === null) return "unknown";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 60) return "critical";
  if (daysLeft <= 180) return "soon";
  return "ample";
}

export interface MatchResult {
  matches: CoverMatch[];
  /**
   * How many payers can be claimed against in parallel without one reducing
   * another. Surfaced separately because it is the fact that changes behaviour:
   * people stop at the first payer, believing the rest are now closed to them.
   */
  stackableCount: number;
  /** Indemnity sources — real costs, reimbursed once between them all. */
  indemnityCount: number;
  /** The nearest hard deadline across everything that applies. */
  nextDeadline: CoverMatch | null;
}

/**
 * Every payer the facts plausibly reach, soonest deadline first.
 */
export function matchCovers(facts: IncidentFacts, now: Date = new Date()): MatchResult {
  const matches: CoverMatch[] = IL_COVER_SOURCES.filter((s) => s.applies(facts)).map((source) => {
    const closesAt =
      facts.occurredAt && source.claimWindowMonths !== null
        ? addMonths(facts.occurredAt, source.claimWindowMonths)
        : null;
    const daysLeft = closesAt ? Math.floor((closesAt.getTime() - now.getTime()) / DAY) : null;
    return {
      source,
      closesAt,
      daysLeft,
      urgency: urgencyOf(daysLeft),
      stacks: source.kind === "compensation",
    };
  });

  // Soonest first; an unknown window sorts after everything with a real date,
  // because a period we cannot place on a calendar cannot be the thing we tell
  // somebody to do first. Expired sorts last but is never dropped — a person is
  // entitled to know what they lost, and to argue about when the clock started.
  const rank = (m: CoverMatch) => {
    if (m.urgency === "expired") return 3;
    if (m.daysLeft === null) return 2;
    return 1;
  };
  matches.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.daysLeft !== null && b.daysLeft !== null && a.daysLeft !== b.daysLeft) {
      return a.daysLeft - b.daysLeft;
    }
    // No date to separate them: fall back to the shorter statutory window, then
    // the id, so the order is total and identical on the server and the device.
    const aw = a.source.claimWindowMonths ?? Number.MAX_SAFE_INTEGER;
    const bw = b.source.claimWindowMonths ?? Number.MAX_SAFE_INTEGER;
    if (aw !== bw) return aw - bw;
    return a.source.id.localeCompare(b.source.id);
  });

  const live = matches.filter((m) => m.urgency !== "expired");

  return {
    matches,
    stackableCount: live.filter((m) => m.stacks).length,
    indemnityCount: live.filter((m) => !m.stacks).length,
    nextDeadline: live.find((m) => m.daysLeft !== null) ?? null,
  };
}

/**
 * Facts we do not have that would change the answer.
 *
 * Asked afterwards rather than upfront. A form that demands nine answers before
 * showing anything is the wall this product exists to remove; a result that
 * says "and if a vehicle was involved, there is an eighth payer" earns the
 * extra tap because the person can already see what it is for.
 */
export function unansweredThatMatter(facts: IncidentFacts): string[] {
  const gaps: string[] = [];
  if (facts.vehicleInvolved === undefined && facts.kind !== "road") gaps.push("vehicleInvolved");
  if (facts.employed === undefined && facts.kind !== "school") gaps.push("employed");
  if (facts.hasPension === undefined) gaps.push("hasPension");
  if (facts.registeredAthlete === undefined && facts.kind === "sport") gaps.push("registeredAthlete");
  if (facts.minor === undefined) gaps.push("minor");
  if (facts.occurredAt === undefined) gaps.push("occurredAt");
  return gaps;
}
