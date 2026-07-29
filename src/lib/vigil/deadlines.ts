/**
 * The Vigil — a countdown on money the person still owns.
 *
 * THE CRITIQUE THIS ANSWERS
 *
 * Real users were asked why they would install this and said: I can just ask an
 * AI. They are right, and the honest reading is worse than it sounds. A rights
 * catalogue and a letter generator are precisely what a chat assistant already
 * does, for free, with no install — so most of the consumer product is a worse
 * version of something everyone already carries.
 *
 * The question that matters is what a chat structurally cannot do. It can write
 * the letter. It cannot send it, chase it, prove authority for it, or know
 * which wording has actually been paid. But those are all things Zakai does
 * *after* the person decides to act, and the reason billions go unclaimed was
 * never that people cannot write letters.
 *
 * It is that nobody notices.
 *
 * A chat is pull. You have to think to ask, on the day it matters, about a
 * thing you do not know exists. Nobody does. And almost every entitlement has a
 * clock on it: tax refunds run out, flight compensation prescribes, a
 * cancellation window is fourteen days, a warranty lapses, a retroactive
 * municipal claim reaches back one year and no further.
 *
 * So this is the part no assistant can replicate, because it needs the three
 * things a conversation has none of: state, time, and memory. It knows what you
 * are owed, when it dies, and how much dies with it — and it says so before,
 * not after.
 *
 * "You have 41 days left to claim ₪4,200, and then it is gone" is a reason to
 * open an app. "Here is a letter you could write" is not.
 *
 * Pure and deterministic: a countdown that moves on its own is not a countdown.
 */

export type LimitPeriod =
  | { kind: "days"; n: number }
  | { kind: "months"; n: number }
  | { kind: "years"; n: number }
  /** No statutory clock — still worth doing, never worth alarming about. */
  | { kind: "none" };

/**
 * What starts the clock. Naming this matters: the same right can prescribe from
 * the payment, the decision, or the end of the tax year, and getting it wrong
 * means telling someone they have a year when they have a week.
 */
export type ClockStart =
  | "event" // the flight, the charge, the purchase
  | "payment" // when money left the person
  | "decision" // when an authority answered
  | "tax_year_end"; // 31 December of the year in question

export interface DeadlineRule {
  rightId: string;
  period: LimitPeriod;
  startsFrom: ClockStart;
  /** The statute or regulation the period comes from. Never a guess. */
  source: string;
  /**
   * True when the clock cannot be restarted once it runs out. A missed
   * prescriptive deadline is money that ceases to exist; a missed
   * administrative one is usually an inconvenience. The product must not shout
   * equally about both.
   */
  absolute: boolean;
}

/**
 * Israel. Conservative by construction: where a period is contested or depends
 * on facts we do not hold, it is recorded as `none` rather than guessed.
 * Inventing a deadline manufactures urgency, which is the exact manipulation
 * this feature would be accused of and the fastest way to lose the right to
 * send anyone a notification.
 */
export const IL_DEADLINES: readonly DeadlineRule[] = [
  {
    rightId: "tax_refund",
    period: { kind: "years", n: 6 },
    startsFrom: "tax_year_end",
    source: "פקודת מס הכנסה [נוסח חדש], סעיף 160",
    absolute: true,
  },
  {
    rightId: "work_grant",
    period: { kind: "years", n: 6 },
    startsFrom: "tax_year_end",
    source: "חוק להגדלת שיעור ההשתתפות בכוח העבודה, התשס״ח-2007",
    absolute: true,
  },
  {
    rightId: "flight_comp",
    period: { kind: "years", n: 4 },
    startsFrom: "event",
    source: "חוק ההתיישנות, התשי״ח-1958, סעיף 5 — תביעה אזרחית",
    absolute: true,
  },
  {
    rightId: "consumer_cancel14",
    period: { kind: "days", n: 14 },
    startsFrom: "event",
    source: "חוק הגנת הצרכן, התשמ״א-1981, סעיף 14ג",
    absolute: true,
  },
  {
    rightId: "unemployment_benefit",
    period: { kind: "months", n: 12 },
    startsFrom: "event",
    source: "חוק הביטוח הלאומי [נוסח משולב], התשנ״ה-1995, סעיף 296",
    absolute: true,
  },
  {
    rightId: "maternity_grant",
    period: { kind: "months", n: 12 },
    startsFrom: "event",
    source: "חוק הביטוח הלאומי, סעיף 296 — תביעה למפרע",
    absolute: true,
  },
  {
    rightId: "miluim_pay",
    period: { kind: "months", n: 12 },
    startsFrom: "event",
    source: "חוק הביטוח הלאומי, סעיף 296",
    absolute: true,
  },
  {
    rightId: "child_allowance",
    period: { kind: "months", n: 12 },
    startsFrom: "event",
    source: "חוק הביטוח הלאומי, סעיף 296 — תשלום רטרואקטיבי מוגבל",
    absolute: true,
  },
  {
    rightId: "arnona_income",
    period: { kind: "years", n: 1 },
    startsFrom: "tax_year_end",
    source: "תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג-1993 — שנת הכספים",
    absolute: true,
  },
  {
    rightId: "severance",
    period: { kind: "years", n: 7 },
    startsFrom: "event",
    source: "חוק הגנת השכר, התשי״ח-1958, סעיף 17א",
    absolute: true,
  },
  {
    rightId: "work_overtime",
    period: { kind: "years", n: 7 },
    startsFrom: "payment",
    source: "חוק הגנת השכר, התשי״ח-1958, סעיף 17א",
    absolute: true,
  },
  {
    rightId: "bank_basic_track",
    period: { kind: "years", n: 7 },
    startsFrom: "payment",
    source: "חוק ההתיישנות, התשי״ח-1958, סעיף 5",
    absolute: true,
  },
  {
    rightId: "parking_appeal",
    period: { kind: "days", n: 30 },
    startsFrom: "event",
    source: "חוק סדר הדין הפלילי [נוסח משולב], התשמ״ב-1982, סעיף 229",
    absolute: true,
  },
  // Standing entitlements with no clock. Present so the absence is a decision
  // somebody made and can be checked, not a gap nobody noticed.
  { rightId: "dormant_money", period: { kind: "none" }, startsFrom: "event", source: "אין התיישנות על כספים רדומים", absolute: false },
  { rightId: "pension_fees", period: { kind: "none" }, startsFrom: "event", source: "זכות מתמשכת — אין מועד אחרון", absolute: false },
  { rightId: "senior_card", period: { kind: "none" }, startsFrom: "event", source: "זכות מתמשכת", absolute: false },
];

const DAY_MS = 86_400_000;

/** Resolve when the clock actually started, given the triggering date. */
export function clockStartDate(rule: DeadlineRule, triggeredAt: Date): Date {
  if (rule.startsFrom !== "tax_year_end") return triggeredAt;
  // A tax-year right does not prescribe from the transaction but from the end
  // of the year it fell in — which is often several months of extra runway, and
  // telling someone otherwise costs them a claim they still had.
  return new Date(Date.UTC(triggeredAt.getUTCFullYear(), 11, 31));
}

/** When this right stops being claimable. Null when nothing prescribes. */
export function expiresAt(rule: DeadlineRule, triggeredAt: Date): Date | null {
  if (rule.period.kind === "none") return null;
  const start = clockStartDate(rule, triggeredAt);
  const d = new Date(start.getTime());
  if (rule.period.kind === "days") d.setUTCDate(d.getUTCDate() + rule.period.n);
  if (rule.period.kind === "months") d.setUTCMonth(d.getUTCMonth() + rule.period.n);
  if (rule.period.kind === "years") d.setUTCFullYear(d.getUTCFullYear() + rule.period.n);
  return d;
}

export type Urgency = "expired" | "critical" | "soon" | "ample" | "no_deadline";

export interface Countdown {
  rightId: string;
  expiresAt: Date | null;
  daysLeft: number | null;
  urgency: Urgency;
  /** Money that ceases to exist on that date, in minor units. */
  valueAtRiskMinor: number;
  absolute: boolean;
  source: string;
}

/**
 * Thresholds are in days rather than percentages of the period, because what
 * matters is whether a person can still act — assembling documents and filing
 * takes about the same fortnight whether the window was two weeks or six years.
 */
const CRITICAL_DAYS = 30;
const SOON_DAYS = 90;

export function urgencyOf(daysLeft: number | null): Urgency {
  if (daysLeft === null) return "no_deadline";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= CRITICAL_DAYS) return "critical";
  if (daysLeft <= SOON_DAYS) return "soon";
  return "ample";
}

export function countdownFor(
  rule: DeadlineRule,
  triggeredAt: Date,
  valueMinor: number,
  now: Date = new Date(),
): Countdown {
  const expiry = expiresAt(rule, triggeredAt);
  const daysLeft = expiry === null ? null : Math.floor((expiry.getTime() - now.getTime()) / DAY_MS);
  return {
    rightId: rule.rightId,
    expiresAt: expiry,
    daysLeft,
    urgency: urgencyOf(daysLeft),
    valueAtRiskMinor: Math.max(0, valueMinor),
    absolute: rule.absolute,
    source: rule.source,
  };
}

export function ruleFor(rightId: string, rules: readonly DeadlineRule[] = IL_DEADLINES) {
  return rules.find((r) => r.rightId === rightId);
}

/**
 * Order what is on the clock.
 *
 * By money about to be lost per day of runway — not by nearest date, and not by
 * largest amount. A ₪50 claim expiring tomorrow should not outrank ₪8,000
 * expiring in three weeks, and an ₪8,000 claim with four years left should not
 * outrank ₪600 with nine days. Urgency alone nags; value alone lets the
 * genuinely urgent slip past. The product only earns a notification if the
 * ranking is right.
 *
 * Expired items sort last and are kept rather than hidden: a person is entitled
 * to know what they lost, and quietly deleting it is how a tool stops being
 * trusted.
 */
export function rankByMoneyAtRisk(countdowns: readonly Countdown[]): Countdown[] {
  const pressure = (c: Countdown) => {
    if (c.urgency === "expired") return -1;
    if (c.daysLeft === null) return 0;
    // +1 so something due today does not divide by zero and dominate everything.
    return c.valueAtRiskMinor / (c.daysLeft + 1);
  };
  return [...countdowns].sort((a, b) => {
    const diff = pressure(b) - pressure(a);
    if (diff !== 0) return diff;
    return a.rightId.localeCompare(b.rightId);
  });
}

/**
 * Should this become a notification?
 *
 * Deliberately hard to satisfy. The right to interrupt someone is spent, not
 * owned: a product that pings about a ₪12 claim with two years left has taught
 * them to ignore the one that matters. Only an absolute deadline, inside the
 * window where acting is still possible, carrying real money, qualifies.
 */
export function worthInterrupting(c: Countdown, minValueMinor = 5_000): boolean {
  return (
    c.absolute &&
    (c.urgency === "critical" || c.urgency === "soon") &&
    c.valueAtRiskMinor >= minValueMinor
  );
}
