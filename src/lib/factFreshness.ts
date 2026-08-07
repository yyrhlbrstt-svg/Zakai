import { ELECTRICITY_RATES_SNAPSHOT } from "@/lib/electricity";

/**
 * One register of every figure in this codebase that was true on the day
 * somebody checked it, and might not be true today.
 *
 * WHY THIS EXISTS
 *
 * Zakai's letters and calculators rest on numbers copied out of the real
 * world: the VAT rate, how many days a landlord has to return a deposit, the
 * deadline for asking the Tax Authority to cut your advances, what the
 * suppliers charge for electricity. Each was verified carefully and each was
 * recorded the same way — as prose in a comment above the constant. Prose
 * cannot be queried, so nothing in the system knew any of these had an age,
 * and nothing would ever notice them going out of date.
 *
 * That is not a tidiness problem. A stale figure in a money app is Zakai
 * stating something false to a bank, a landlord or a tax office in a user's
 * name, over their signature. Israel's VAT rate moved to 18% in January 2025;
 * the next time it moves, `VAT_RATE_PERCENT` is simply wrong, every VAT
 * calculation quietly returns the wrong answer, and nobody finds out from the
 * code.
 *
 * HOW THIS DIFFERS FROM THE LAW WATCHER
 *
 * `autopilot/lawWatcher.ts` already exists and does something adjacent but
 * not the same: it hashes the pages behind the citation URLs on jurisdiction
 * pack rights and reports when one changes. That only reaches facts that (a)
 * live in a pack and (b) carry an http source. Every figure below fails at
 * least one of those — `VAT_RATE_PERCENT` is a TypeScript constant with a
 * prose comment, and an electricity tariff comes off a supplier's price list
 * with no stable URL to diff. The watcher answers "did this page change";
 * this answers "when did a person last confirm this number", which is the
 * question nothing was asking.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not go and read the law itself. An LLM given a search engine and
 * write access to these constants would eventually misread a government page
 * and silently change a tax rate — which is precisely the fabrication the
 * product forbids, dressed up as automation. Machines are good at noticing
 * that something is due for a look; deciding what a statute now says is a
 * person's job. So this register raises its hand, names the source to open,
 * and stops there.
 */
export interface DatedFact {
  /** Stable id — used in the founder surface and in test failures. */
  id: string;
  /** What is actually at risk of being wrong, in plain words. */
  what: string;
  /** Where to look to re-verify it. */
  source: string;
  /** File that holds the value, so a reviewer goes straight there. */
  module: string;
  /** YYYY-MM of the last real verification. */
  verified: string;
  /**
   * How long this may go unchecked. Statutes move slowly and are announced;
   * commercial tariffs move quietly and often, so they get a shorter leash.
   */
  maxAgeMonths: number;
}

export const DATED_FACTS: readonly DatedFact[] = [
  {
    id: "vat-rate",
    what: "Israeli VAT rate (currently 18%) — every VAT calculation depends on it",
    source: "https://www.gov.il/he/departments/israel_tax_authority",
    module: "src/lib/vat.ts",
    verified: "2026-07",
    maxAgeMonths: 6,
  },
  {
    id: "electricity-rates",
    what: "Private electricity supplier discounts",
    source: "Supplier public price lists (Electra / Cellcom / Bezeq / Partner)",
    module: "src/lib/electricity.ts",
    verified: ELECTRICITY_RATES_SNAPSHOT,
    maxAgeMonths: 9,
  },
  {
    id: "deposit-return",
    what: "Days a landlord has to return a rental deposit, and the deposit cap",
    source: "חוק השכירות והשאילה (2017 gazette text)",
    module: "src/lib/depositReturn.ts",
    verified: "2026-07",
    maxAgeMonths: 18,
  },
  {
    id: "late-payment",
    what: "Statutory payment terms and late-payment interest for suppliers",
    source: "חוק מועדי תשלום לספקים",
    module: "src/lib/latePaymentClaim.ts",
    verified: "2026-07",
    maxAgeMonths: 18,
  },
  {
    id: "advance-tax",
    what: "Form 2216א filing deadline for reducing income-tax advances",
    source: "https://www.gov.il/he/service/itc-2216a",
    module: "src/lib/advanceTaxReduction.ts",
    verified: "2026-07",
    maxAgeMonths: 12,
  },
  {
    id: "overtime",
    what: "Overtime multipliers and the daily hour thresholds",
    source: "חוק שעות עבודה ומנוחה",
    module: "src/lib/overtimeBackPay.ts",
    verified: "2026-07",
    maxAgeMonths: 18,
  },
  {
    id: "payslip",
    what: "Minimum wage and payslip-line figures",
    source: "משרד העבודה — שכר מינימום",
    module: "src/lib/payslip.ts",
    verified: "2026-07",
    maxAgeMonths: 9,
  },
  {
    id: "parent-payments",
    what: "Ministry of Education caps on what a school may charge parents",
    source: "חוזר מנכ״ל — תשלומי הורים",
    module: "src/lib/parentPayments.ts",
    verified: "2026-07",
    maxAgeMonths: 12,
  },
  {
    id: "complaint-escalation",
    what: "Regulator escalation routes and their response windows",
    source: "בנק ישראל / רשות שוק ההון / הממונה על הגנת הצרכן",
    module: "src/lib/complaintEscalation.ts",
    verified: "2026-07",
    maxAgeMonths: 18,
  },
];

/** Whole months elapsed since a fact was last verified. */
export function factAgeMonths(fact: DatedFact, now: Date = new Date()): number {
  const [y, m] = fact.verified.split("-").map(Number);
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);
}

/** Facts past their leash, oldest first — what a person should re-check now. */
export function staleFacts(now: Date = new Date()): DatedFact[] {
  return DATED_FACTS.filter((f) => factAgeMonths(f, now) > f.maxAgeMonths).sort(
    (a, b) => factAgeMonths(b, now) - factAgeMonths(a, now),
  );
}

/**
 * Facts approaching their limit — surfaced before they lapse, so re-checking
 * is a scheduled task rather than an emergency after the fact is already wrong.
 */
export function factsDueSoon(withinMonths = 2, now: Date = new Date()): DatedFact[] {
  return DATED_FACTS.filter((f) => {
    const age = factAgeMonths(f, now);
    return age <= f.maxAgeMonths && age > f.maxAgeMonths - withinMonths;
  });
}
