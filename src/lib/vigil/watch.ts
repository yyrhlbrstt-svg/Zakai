/**
 * Turning a profile into a countdown, with nothing asked of the person.
 *
 * THE CONSTRAINT THAT SHAPED THIS
 *
 * A deadline needs a start date, and the profile holds none. The obvious
 * response is to ask — when was the flight, when did you pay — and that is
 * exactly the friction the users rejected. A screen of date pickers is worse
 * than a chat assistant, not better.
 *
 * The way out is that a large share of the money on a clock does not need a
 * date from anyone. Rights whose limitation period runs from the end of a tax
 * year have a start we can compute: if you are employed, there are six open tax
 * years behind you, the oldest one dies on a date already knowable, and nobody
 * had to be asked anything.
 *
 * So the default is a real countdown on real money at zero input. Dates are
 * accepted where the person happens to have them, and their absence narrows the
 * picture rather than blocking it — which is the correct relationship between a
 * product and the facts it does not have.
 *
 * Everything here is pure. A countdown that changes when nothing changed is not
 * a countdown, and this one has to be reproducible on the device that renders it
 * and on the server that decides whether to interrupt someone.
 */

import type { RightsProfile } from "../rights";
import {
  IL_DEADLINES,
  countdownFor,
  rankByMoneyAtRisk,
  ruleFor,
  worthInterrupting,
  type Countdown,
  type DeadlineRule,
} from "./deadlines";

/** A date the person supplied, when they had one. */
export interface EventDate {
  rightId: string;
  occurredAt: Date;
}

export interface WatchInput {
  profile: RightsProfile;
  /** Rights the profile qualifies for, with a conservative value each. */
  eligible: readonly { id: string; yearlyMinor?: number; oneTimeMinor?: number }[];
  /** Optional; every right that has one gets a precise countdown instead of an inferred one. */
  events?: readonly EventDate[];
  /** Rights already acted on — nothing on the clock that is already handled. */
  actedOn?: readonly string[];
  now?: Date;
}

export interface WatchItem extends Countdown {
  /**
   * Where the start date came from. Surfaced because "your 2020 tax year closes
   * in 41 days" and "the flight you told us about prescribes in 41 days" are
   * different claims, and presenting an inference as a fact is how a countdown
   * stops being believed.
   */
  basis: "tax_year" | "reported_event" | "assumed_recent";
  /** For tax-year rights, which year this countdown is about. */
  taxYear?: number;
}

/** How many tax years back a claim can still reach, for the rights that work this way. */
const OPEN_TAX_YEARS = 6;

function valueOf(right: { yearlyMinor?: number; oneTimeMinor?: number }): number {
  return Math.max(0, right.yearlyMinor ?? 0) + Math.max(0, right.oneTimeMinor ?? 0);
}

/**
 * Build the watch list.
 *
 * Tax-year rights expand into one countdown per open year, because that is what
 * is actually true: a person is not owed one refund, they are owed up to six,
 * and the oldest is the one with a date on it. Collapsing them into a single
 * entry hides the only urgent thing in the set.
 */
export function buildWatchList(input: WatchInput): WatchItem[] {
  const now = input.now ?? new Date();
  const acted = new Set(input.actedOn ?? []);
  const byRight = new Map(input.eligible.map((r) => [r.id, r]));
  const events = new Map((input.events ?? []).map((e) => [e.rightId, e.occurredAt]));
  const items: WatchItem[] = [];

  for (const right of input.eligible) {
    if (acted.has(right.id)) continue;
    const rule: DeadlineRule | undefined = ruleFor(right.id, IL_DEADLINES);
    if (!rule || rule.period.kind === "none") continue;

    const value = valueOf(right);

    // A date the person gave us beats anything we could infer.
    const reported = events.get(right.id);
    if (reported) {
      items.push({ ...countdownFor(rule, reported, value, now), basis: "reported_event" });
      continue;
    }

    if (rule.startsFrom === "tax_year_end") {
      // One countdown per open year. The oldest carries the deadline that
      // matters; the rest are money sitting there with no urgency yet.
      const thisYear = now.getUTCFullYear();
      for (let back = 1; back <= OPEN_TAX_YEARS; back++) {
        const year = thisYear - back;
        const triggeredAt = new Date(Date.UTC(year, 6, 1));
        const countdown = countdownFor(rule, triggeredAt, value, now);
        if (countdown.urgency === "expired") continue;
        items.push({ ...countdown, basis: "tax_year", taxYear: year });
      }
      continue;
    }

    // Event-based and no date given. We do not invent one: an assumed date
    // produces an assumed deadline, and a deadline that turns out to be wrong
    // in the alarming direction is the one thing this feature cannot afford.
    void byRight;
  }

  return rankByMoneyAtRisk(items) as WatchItem[];
}

export interface WatchSummary {
  items: WatchItem[];
  /** Money that disappears within the next 90 days, in minor units. */
  atRiskSoonMinor: number;
  /** The single thing most worth doing now, or null when nothing is pressing. */
  mostUrgent: WatchItem | null;
  /** Items that clear the bar for interrupting someone. */
  alertable: WatchItem[];
}

export function summariseWatch(input: WatchInput): WatchSummary {
  const items = buildWatchList(input);
  const live = items.filter((i) => i.urgency !== "expired");

  const atRiskSoonMinor = live
    .filter((i) => i.urgency === "critical" || i.urgency === "soon")
    .reduce((sum, i) => sum + i.valueAtRiskMinor, 0);

  const alertable = live.filter((i) => worthInterrupting(i));

  return {
    items,
    atRiskSoonMinor,
    // The most urgent item is the top of the money-at-risk ranking, not the
    // nearest date — the ranking already encodes the judgement, and second-
    // guessing it here would let the two disagree.
    mostUrgent: live[0] ?? null,
    alertable,
  };
}

/**
 * Should we send this person a notification today?
 *
 * One alert, for one thing, or none. A digest of five deadlines is a newsletter,
 * and a newsletter is ignored; the entire value of knowing what is most urgent
 * is spent by listing everything alongside it.
 */
export function todaysAlert(summary: WatchSummary): WatchItem | null {
  return summary.alertable[0] ?? null;
}
