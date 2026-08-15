/**
 * The clock on a baggage claim.
 *
 * The Montreal Convention gives a passenger a fixed, short window to complain
 * in writing, and it is the fact most likely to decide the claim — an airline
 * that can point at a missed deadline does not need to argue about the money.
 *
 *   Art. 31(2): damage to checked baggage — 7 days from receipt.
 *                delay — 21 days from the date the baggage was placed at the
 *                passenger's disposal.
 *
 * Lost baggage is different in kind and is deliberately not given a 7 or 21
 * day window here: a bag is not formally lost until the carrier says so or 21
 * days pass, after which the claim is for non-delivery and the limitation
 * period is the two-year one in Art. 35. Inventing a short deadline for it
 * would tell somebody with a live claim that they were too late.
 */

export const BAGGAGE_KINDS = ["lost", "damaged", "delayed"] as const;
export type BaggageKind = (typeof BAGGAGE_KINDS)[number];

/** Days to complain in writing, or null where no short window applies. */
export const COMPLAINT_DAYS: Record<BaggageKind, number | null> = {
  damaged: 7,
  delayed: 21,
  // See above — not a short-window claim.
  lost: null,
};

const DAY_MS = 86_400_000;

/**
 * The date by which a written complaint must be made, from the date the
 * passenger got the bag back (or the flight arrived).
 *
 * Returns null when the kind has no short window, and when the date cannot be
 * read. A confidently wrong deadline in a letter to an airline is worse than
 * none: it hands them a date to hold the passenger to.
 */
export function baggageDeadline(kind: BaggageKind, incidentDate: string): Date | null {
  const days = COMPLAINT_DAYS[kind];
  if (days === null) return null;

  const start = parseDate(incidentDate);
  if (!start) return null;
  return new Date(start.getTime() + days * DAY_MS);
}

/**
 * Whether the window has already closed, given the day the claim is made.
 *
 * Deliberately reports "unknown" rather than "in time" when there is no
 * window to check. A claim nobody can date is not a claim anybody should be
 * told is safe.
 */
export function baggageWindowState(
  kind: BaggageKind,
  incidentDate: string,
  now: Date = new Date(),
): "in_time" | "closed" | "unknown" {
  const deadline = baggageDeadline(kind, incidentDate);
  if (!deadline) return "unknown";
  return midnight(now).getTime() <= midnight(deadline).getTime() ? "in_time" : "closed";
}

function parseDate(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject a date that rolls over (2026-02-30 becoming March).
  return d.toISOString().slice(0, 10) === v ? d : null;
}

function midnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
