/**
 * The Rights Graph registry — every encoded right, plus the one gate that
 * makes `draft` mean something: letter-building code may only resolve rights
 * through `rightForLetter()`, which throws on anything not `verified`.
 *
 * Adding a right is adding data here; it is validated against RightSchema by
 * rightsGraph.test.ts, so an entry that lies about itself (a verified right
 * with no source, a formula the evaluator can't run) fails CI, not a user.
 */

import { RightSchema, type Right } from "./schema";

/**
 * il.consumer.31a.continued-billing-after-cancellation
 *
 * The first fully-graphed right — the same statutory position legalTeeth.ts
 * shipped into cancellation letters, now as machine-readable data. Verified
 * August 2026 against the consolidated text on Nevo (cross-checked with
 * Kol-Zchut summaries): §13ד allows written cancellation of a continuing
 * transaction and §13ד(ג) obliges the business to stop charging; continuing
 * to charge afterwards is enumerated in §31א(א), for which a court may award
 * exemplary damages up to ₪10,000 without proof of damage; §31א(ב) makes a
 * prior written demand the precondition — which Zakai's letters create.
 */
const CONTINUED_BILLING_AFTER_CANCELLATION: Right = {
  id: "il.consumer.31a.continued-billing-after-cancellation",
  jurisdiction: "IL",
  domain: "subscriptions",
  title: {
    he: "המשך חיוב לאחר הודעת ביטול בכתב של עסקה מתמשכת",
    en: "Continued billing after written cancellation of a continuing transaction",
  },
  statute: {
    name: 'חוק הגנת הצרכן, התשמ"א-1981',
    section: "31א(א), יחד עם 13ד(ג); דרישה בכתב לפי 31א(ב)",
    sourceUrl: "https://www.nevo.co.il/law_html/law00/70305.htm",
    version: "2026-08-19",
    lastVerifiedAt: "2026-08-19",
  },
  trigger: [
    { kind: "fact", field: "continuing_transaction", op: "eq", value: true },
    { kind: "fact", field: "written_cancellation_sent", op: "eq", value: true },
    { kind: "fact", field: "charged_after_cancellation", op: "eq", value: true },
  ],
  obligor: { type: "provider", directoryRef: "provider:self" },
  remedy: {
    kind: "statutory_damages",
    // The court may award up to the cap without proof of damage; the amounts
    // actually charged after cancellation are refundable on top, which is why
    // the remedy here is the cap alone rather than min(charged, cap).
    capMinor: 1_000_000, // ₪10,000 in agorot
    currency: "ILS",
  },
  procedure: {
    channel: "letter",
    recipientDirectoryRef: "provider:self",
    responseDeadlineDays: 14,
    evidenceRequired: ["cancellation_notice_copy", "post_cancellation_charge_record"],
  },
  escalation: [
    "followup_continued_billing", // legalTeeth.buildContinuedBillingFollowUp
    "regulator_complaint", // complaintEscalation.ts (consumer authority)
    "small_claims_package",
  ],
  status: "verified",
};

/**
 * Draft example of the discovery roadmap — deliberately NOT verified.
 * TODO(source): encode the current-year credit-point values and eligibility
 * rules from the Tax Authority's published tables before any of this can
 * reach a user-facing artifact. Kept here so the draft gate below is guarding
 * something real, not an empty set.
 */
const UNUSED_TAX_CREDIT_POINTS_DRAFT: Right = {
  id: "il.banking.tax.credit-points-unused",
  jurisdiction: "IL",
  domain: "banking",
  title: {
    he: "נקודות זיכוי ממס הכנסה שלא נוצלו",
    en: "Unused income-tax credit points",
  },
  statute: {
    name: "פקודת מס הכנסה [נוסח חדש]",
    section: "34–40",
    sourceUrl: "https://www.gov.il/he/departments/israel_tax_authority",
    version: "2026-08-19",
    lastVerifiedAt: "2026-08-19",
  },
  trigger: [{ kind: "fact", field: "employed_last_6_years", op: "eq", value: true }],
  obligor: { type: "state", directoryRef: "regulator:tax-authority" },
  remedy: { kind: "refund", formula: "estimated_refund_minor", currency: "ILS" },
  procedure: {
    channel: "form",
    recipientDirectoryRef: "regulator:tax-authority",
    responseDeadlineDays: 90,
    evidenceRequired: ["form_106"],
  },
  escalation: ["counsel_handoff"],
  status: "draft",
  todoSource:
    "TODO(source): per-year credit-point values + eligibility table from the Tax Authority; section range needs confirmation against the consolidated ordinance text.",
};

export const RIGHTS: readonly Right[] = [
  CONTINUED_BILLING_AFTER_CANCELLATION,
  UNUSED_TAX_CREDIT_POINTS_DRAFT,
];

export function getRight(id: string): Right | undefined {
  return RIGHTS.find((r) => r.id === id);
}

export function verifiedRights(): Right[] {
  return RIGHTS.filter((r) => r.status === "verified");
}

export class DraftRightError extends Error {
  constructor(id: string) {
    super(
      `right "${id}" is not verified — draft law never reaches a letter. ` +
        "Verify it against its source (and clear todoSource) first.",
    );
    this.name = "DraftRightError";
  }
}

/**
 * The gate. Letter-building code resolves rights ONLY through here, so
 * flipping a right to draft structurally disables every letter built on it —
 * asserted in rightsGraph.test.ts and exercised for real by legalTeeth.ts.
 */
export function rightForLetter(id: string): Right {
  const right = getRight(id);
  if (!right) throw new DraftRightError(id);
  if (right.status !== "verified") throw new DraftRightError(id);
  // Belt and braces: a "verified" entry that fails its own schema is treated
  // as draft rather than trusted — validation is cheap and letters are not.
  const parsed = RightSchema.safeParse(right);
  if (!parsed.success) throw new DraftRightError(id);
  return right;
}
