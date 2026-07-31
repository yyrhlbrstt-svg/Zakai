/**
 * Captive pricing — the third category, and the largest one.
 *
 * THE GAP THIS CLOSES
 *
 * The product had two ideas about money: rights, which somebody owes you by
 * law, and overcharges, where you were billed wrongly. A user pointed out that
 * mortgage life insurance is routinely far more expensive when bought from the
 * bank than direct, and that observation does not fit either box. The price is
 * legal. The billing is correct. Nothing is owed and nothing was overcharged.
 *
 * It is a third thing: a product sold at the moment the buyer was cornered.
 * You are signing a mortgage, the bank offers the policy across the desk, and
 * declining means another appointment and a delay on the largest purchase of
 * your life. So you take it, and pay a premium every month for twenty years for
 * a decision that took four seconds.
 *
 * This is where the biggest consumer money actually sits, and why it is
 * invisible to everyone else. A bank-feed aggregator sees the charge and reads
 * it as a normal, expected bill — it is one. Nothing about the transaction
 * says the same cover is available elsewhere for materially less. That is not a
 * data-access problem, which is why more bank access does not solve it. It is a
 * knowledge problem about the market the buyer never got to see.
 *
 * WHAT THIS FILE REFUSES TO DO
 *
 * It states no specific saving. Every entry carries a range drawn from what the
 * market openly advertises, and every range is explicitly a prompt to check the
 * person's own numbers rather than a promise. Telling somebody they will save
 * 30% on a policy whose terms nobody has read is the behaviour that makes this
 * whole category untrustworthy, and it is the reason people already distrust
 * anyone offering to "review your insurance".
 */

export type CaptiveCategory =
  | "insurance"
  | "credit"
  | "pension"
  | "banking"
  | "utility";

/** Why the buyer had no practical choice at the moment of sale. */
export type CaptivityReason =
  | "bundled_at_signing" // offered across the desk during a bigger transaction
  | "default_enrolment" // you were placed in it and never chose
  | "switching_friction" // leaving requires effort the seller controls
  | "opaque_pricing"; // the alternative was never visible to compare against

export interface CaptiveProduct {
  id: string;
  category: CaptiveCategory;
  reason: CaptivityReason;
  /**
   * Typical premium over the openly available market price, as a fraction.
   * A range, never a figure: the true gap depends on age, health, balance and
   * term, and a single number would be a forecast about a person we have not met.
   */
  typicalPremiumOverMarket: [number, number];
  /**
   * The legal basis for being allowed to leave. Present because "you may switch"
   * is the claim people disbelieve, and a citation is what makes it actionable
   * rather than aspirational.
   */
  rightToSwitch: string;
  /** What the person must have in hand. Kept short — a long list is a refusal. */
  needs: string[];
  /**
   * Whether leaving can be done without the incumbent's cooperation. Where it
   * cannot, the honest framing is different: this becomes a negotiation, not a
   * switch, and the expected outcome is smaller.
   */
  switchableWithoutIncumbent: boolean;
}

/**
 * Israel. Ordered roughly by how much money sits in each for a typical
 * household, not by how easy they are to explain.
 */
export const IL_CAPTIVE: readonly CaptiveProduct[] = [
  {
    id: "mortgage_life_insurance",
    category: "insurance",
    reason: "bundled_at_signing",
    // Sold at the mortgage desk, priced against a buyer who will not walk away
    // from a signing over a monthly premium. The direct market is open and
    // materially cheaper, and the regulator has pushed repeatedly on exactly
    // this gap — which is itself evidence the gap is real and persistent.
    typicalPremiumOverMarket: [0.2, 0.45],
    rightToSwitch:
      "חוזר גופים מוסדיים — זכות המבוטח לרכוש ביטוח חיים למשכנתא מכל מבטח, והבנק אינו רשאי להתנות את ההלוואה ברכישה דרכו",
    needs: ["גובה ההלוואה ויתרתה", "גיל ומצב עישון", "הפוליסה הנוכחית"],
    switchableWithoutIncumbent: true,
  },
  {
    id: "mortgage_property_insurance",
    category: "insurance",
    reason: "bundled_at_signing",
    typicalPremiumOverMarket: [0.15, 0.4],
    rightToSwitch:
      "חוזר גופים מוסדיים — ביטוח מבנה למשכנתא ניתן לרכישה מכל מבטח; לבנק זכות לוודא כיסוי בלבד",
    needs: ["שווי המבנה לביטוח", "הפוליסה הנוכחית"],
    switchableWithoutIncumbent: true,
  },
  {
    id: "pension_management_fees",
    category: "pension",
    reason: "default_enrolment",
    // Placed into a fund by an employer, at a rate set for a member who will
    // never look. The advertised rate for a new joiner is often far lower than
    // the one a long-standing member is quietly paying.
    typicalPremiumOverMarket: [0.3, 0.7],
    rightToSwitch:
      "חוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה-2005 — זכות ניוד ובחירת גוף מנהל",
    needs: ["דוח פנסיוני אחרון", "שיעורי דמי הניהול מצבירה ומהפקדה"],
    switchableWithoutIncumbent: true,
  },
  {
    id: "disability_rider",
    category: "insurance",
    reason: "opaque_pricing",
    typicalPremiumOverMarket: [0.15, 0.35],
    rightToSwitch: "חוזר גופים מוסדיים — ניוד וביטול כיסויים נלווים",
    needs: ["פירוט הכיסויים הקיימים", "שכר ברוטו"],
    switchableWithoutIncumbent: true,
  },
  {
    id: "credit_card_fx_margin",
    category: "credit",
    reason: "opaque_pricing",
    // The margin is disclosed and nobody reads it at the till. The alternative
    // exists and is never presented at the moment of the transaction.
    typicalPremiumOverMarket: [0.5, 2.5],
    rightToSwitch: "אין מגבלה — כרטיס חלופי או ארנק מטבע נפרד",
    needs: ["היקף הוצאה שנתית במט״ח"],
    switchableWithoutIncumbent: true,
  },
  {
    id: "bank_securities_fees",
    category: "banking",
    reason: "switching_friction",
    typicalPremiumOverMarket: [0.4, 1.5],
    rightToSwitch: "חוק שירות פיננסי מוסדר; ניוד תיק ניירות ערך בין גופים",
    needs: ["דמי משמרת ועמלות קנייה/מכירה בפועל", "שווי התיק"],
    switchableWithoutIncumbent: false,
  },
  {
    id: "car_loan_insurance",
    category: "insurance",
    reason: "bundled_at_signing",
    typicalPremiumOverMarket: [0.2, 0.5],
    rightToSwitch: "חוק הפיקוח על שירותים פיננסיים (ביטוח) — איסור התניית שירות בשירות",
    needs: ["פרטי ההלוואה", "הפוליסה שנמכרה עם הרכב"],
    switchableWithoutIncumbent: true,
  },
];

export interface CaptiveEstimate {
  product: CaptiveProduct;
  /** What they pay now, in minor units per month. Supplied by the person. */
  currentMonthlyMinor: number;
  /** Conservative and optimistic annual saving, in minor units. */
  annualSavingRangeMinor: [number, number];
  /** Over the remaining life of the commitment, when there is one. */
  lifetimeSavingRangeMinor: [number, number] | null;
}

/**
 * Estimate the gap, from a figure the person actually gave us.
 *
 * Deliberately requires the current cost rather than assuming a typical one.
 * An assumed premium multiplied by an assumed overcharge is two guesses
 * presented as a number, and the resulting figure would be wrong in the
 * direction that flatters us.
 *
 * The overpay is computed as a share of the *current* price rather than of the
 * market price. Paying 40% over market means the saving is 40/140 of the bill,
 * not 40% of it — the arithmetic everyone gets wrong in the direction that
 * overstates the win.
 */
export function estimateCaptive(
  product: CaptiveProduct,
  currentMonthlyMinor: number,
  remainingMonths?: number,
): CaptiveEstimate {
  // Non-finite input yields zero rather than NaN. `parseFloat` on an empty or
  // malformed field gives NaN, and Math.max(0, NaN) is NaN — which would reach
  // a screen as "₪NaN". The caller currently guards this; the function must not
  // depend on every future caller remembering to.
  const monthly = Number.isFinite(currentMonthlyMinor)
    ? Math.max(0, Math.round(currentMonthlyMinor))
    : 0;
  const [lo, hi] = product.typicalPremiumOverMarket;
  const share = (over: number) => over / (1 + over);

  const annualLo = Math.round(monthly * 12 * share(lo));
  const annualHi = Math.round(monthly * 12 * share(hi));

  return {
    product,
    currentMonthlyMinor: monthly,
    annualSavingRangeMinor: [annualLo, annualHi],
    lifetimeSavingRangeMinor:
      remainingMonths && Number.isFinite(remainingMonths) && remainingMonths > 0
        ? [
            Math.round(monthly * remainingMonths * share(lo)),
            Math.round(monthly * remainingMonths * share(hi)),
          ]
        : null,
  };
}

/**
 * Order by the conservative end of the range, not the optimistic one.
 *
 * Ranking on the best case sorts the list by how boldly each entry was
 * estimated, which rewards whichever range somebody wrote most confidently.
 * The low end is the number we would still stand behind if challenged, so it is
 * the one that decides what a person is told to do first.
 */
export function rankCaptive(estimates: readonly CaptiveEstimate[]): CaptiveEstimate[] {
  return [...estimates].sort((a, b) => {
    const diff = b.annualSavingRangeMinor[0] - a.annualSavingRangeMinor[0];
    if (diff !== 0) return diff;
    return a.product.id.localeCompare(b.product.id);
  });
}

export function captiveById(id: string): CaptiveProduct | undefined {
  return IL_CAPTIVE.find((p) => p.id === id);
}

/**
 * Which of these apply to somebody, from facts they have already given.
 *
 * Nothing here needs a bank connection, an upload or a document — which is the
 * point. A feed-based competitor can see the charge and cannot tell that a
 * cheaper identical product exists; we can say so without seeing the charge at
 * all.
 */
export function captiveFor(facts: {
  hasMortgage?: boolean;
  hasCarLoan?: boolean;
  employed?: boolean;
  spendsForeignCurrency?: boolean;
  holdsSecurities?: boolean;
}): CaptiveProduct[] {
  const out: CaptiveProduct[] = [];
  const add = (id: string) => {
    const p = captiveById(id);
    if (p) out.push(p);
  };

  if (facts.hasMortgage) {
    add("mortgage_life_insurance");
    add("mortgage_property_insurance");
  }
  if (facts.hasCarLoan) add("car_loan_insurance");
  if (facts.employed) {
    add("pension_management_fees");
    add("disability_rider");
  }
  if (facts.spendsForeignCurrency) add("credit_card_fx_margin");
  if (facts.holdsSecurities) add("bank_securities_fees");
  return out;
}
