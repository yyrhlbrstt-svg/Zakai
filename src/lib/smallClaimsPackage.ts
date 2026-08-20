/**
 * Small-claims package generator — Master Build Prompt v2, Phase 2: the
 * biggest missing artifact on the escalation ladder.
 *
 * Every continued-billing follow-up letter already tells the provider that
 * "הכנת תיק לתביעה בבית המשפט לתביעות קטנות" is the next rung. This module
 * makes that sentence true: a deterministic, reviewable draft of a claim
 * statement (כתב תביעה) plus the evidence checklist and filing facts —
 * generated from the Rights Graph right, the case's own written-demand
 * trail, and nothing else. No LLM anywhere in this path.
 *
 * VERIFIED FILING FACTS (checked 2026-08-20 against the Judicial Authority
 * on gov.il — https://www.gov.il/he/service/filing_a_small_claim and the
 * court-fees page):
 *  - Maximum claim: ₪39,900, as of 2026-01-01. The ceiling is updated
 *    periodically, which is why it is stored with its as-of date and the
 *    artifact tells the person to re-check before filing.
 *  - Filing fee: 1% of the claim amount, minimum ₪50. A fee-exemption
 *    request is possible on economic-hardship grounds.
 *
 * HONESTY RULES (non-negotiables #1, #5, #6):
 *  - Zakai PREPARES a draft; the person reviews and files it themselves.
 *    Nothing here ever claims a claim was filed.
 *  - The exemplary-damages figure comes from the Rights Graph entry through
 *    rightForLetter() — the draft gate — never typed here. The statement
 *    says the court MAY award up to the cap; it promises nothing.
 *  - Amounts are integer agorot. The requested total is clamped to the
 *    small-claims ceiling and says so when clamping happened.
 *  - The timeline is the case's real Outbox trail; a message still QUEUED is
 *    described as created-not-dispatched, never as sent.
 */

import { rightForLetter, rightIdForVertical } from "@/lib/rightsGraph/registry";
import { cancelTeethBasis } from "@/lib/legalTeeth";

/** ₪39,900 in agorot — Judicial Authority, as of 2026-01-01 (see header). */
export const SMALL_CLAIMS_CAP_AGOROT = 3_990_000;
export const SMALL_CLAIMS_CAP_AS_OF = "2026-01-01";
export const SMALL_CLAIMS_FILING_URL = "https://www.gov.il/he/service/filing_a_small_claim";

/** Filing fee: 1% of the claim, minimum ₪50 — integer agorot throughout. */
export function smallClaimsFeeAgorot(claimAgorot: number): number {
  if (!Number.isFinite(claimAgorot) || claimAgorot <= 0) return 5_000;
  return Math.max(Math.round(claimAgorot / 100), 5_000);
}

/**
 * v1 deliberately supports exactly the right it can narrate correctly: the
 * verified §31א continued-billing right. A claim statement is a story with
 * legal anchors, not a template with blanks — pretending this generator is
 * generic over rights it has no narrative for would produce artifacts that
 * read wrong in court. New rights get support by adding their narrative,
 * asserted here, not by removing this check.
 */
export const SUPPORTED_RIGHT_ID = "il.consumer.31a.continued-billing-after-cancellation";

export class SmallClaimsUnsupportedError extends Error {
  constructor(vertical: string) {
    super(
      `small-claims package does not support vertical "${vertical}" — only rights ` +
        "with an encoded claim narrative can be drafted (today: continued billing " +
        "after written cancellation).",
    );
    this.name = "SmallClaimsUnsupportedError";
  }
}

export interface SmallClaimsTimelineEntry {
  /** Human-readable date label, already formatted (e.g. "12.6.2026"). */
  dateLabel: string;
  /** What happened — written by the caller from real records, e.g. subject + delivery state. */
  label: string;
}

export interface SmallClaimsPackageInput {
  vertical: string;
  claimantName: string;
  /** Optional — included only when supplied; never invented. */
  claimantIdNumber?: string;
  claimantAddress?: string;
  company: string;
  companyAddress?: string;
  product: string;
  /** Date label of the original written cancellation notice. */
  cancelNoticeDateLabel: string;
  /** Charges observed after the notice, integer agorot — only what was actually seen. */
  chargedAfterAgorot?: number;
  /** The case's real written-demand trail (Outbox), oldest first. */
  timeline: readonly SmallClaimsTimelineEntry[];
}

export interface SmallClaimsPackage {
  title: string;
  /** The claim-statement draft, Hebrew, ready for review — not for auto-filing. */
  claimStatement: string;
  evidenceChecklist: string[];
  /** Requested total = refund + statutory cap, clamped to the ceiling. */
  requestedTotalAgorot: number;
  cappedByCeiling: boolean;
  filingFeeAgorot: number;
  filing: {
    url: string;
    capAgorot: number;
    capAsOf: string;
    feeRuleHe: string;
    notesHe: string[];
  };
}

const EVIDENCE_LABEL_HE: Record<string, string> = {
  cancellation_notice_copy: "עותק הודעת הביטול בכתב, כולל תאריך המשלוח ואישור השליחה",
  post_cancellation_charge_record:
    "אסמכתה לחיוב שבוצע לאחר מועד הביטול (דף חשבון או פירוט כרטיס אשראי)",
};

const shekels = (agorot: number): string =>
  `₪${Math.round(agorot / 100).toLocaleString("he-IL")}`;

export function buildSmallClaimsPackage(input: SmallClaimsPackageInput): SmallClaimsPackage {
  const rightId = rightIdForVertical(input.vertical);
  if (rightId !== SUPPORTED_RIGHT_ID) throw new SmallClaimsUnsupportedError(input.vertical);
  // The draft gate: throws on anything not verified — draft law reaches no artifact.
  const right = rightForLetter(rightId);
  const basis = cancelTeethBasis();

  const refundAgorot =
    input.chargedAfterAgorot && input.chargedAfterAgorot > 0
      ? Math.round(input.chargedAfterAgorot)
      : 0;
  const exemplaryCapAgorot = right.remedy.capMinor ?? 0;
  const uncapped = refundAgorot + exemplaryCapAgorot;
  const requestedTotalAgorot = Math.min(uncapped, SMALL_CLAIMS_CAP_AGOROT);
  const cappedByCeiling = uncapped > SMALL_CLAIMS_CAP_AGOROT;

  const claimant = input.claimantName.trim() || "התובע/ת";
  const company = input.company.trim() || "הנתבעת";
  const product = input.product.trim() || "השירות";

  const partyLines = [
    `התובע/ת: ${claimant}`,
    ...(input.claimantIdNumber?.trim() ? [`ת"ז: ${input.claimantIdNumber.trim()}`] : []),
    ...(input.claimantAddress?.trim() ? [`מען: ${input.claimantAddress.trim()}`] : []),
    "",
    `הנתבעת: ${company}`,
    ...(input.companyAddress?.trim() ? [`מען: ${input.companyAddress.trim()}`] : []),
  ];

  const timelineLines =
    input.timeline.length > 0
      ? input.timeline.map((e, i) => `${i + 1}. ${e.dateLabel} — ${e.label}`)
      : ["(יש לצרף את פירוט הפניות בכתב לנתבעת)"];

  const chargedLine =
    refundAgorot > 0
      ? `למרות הודעת הביטול, הנתבעת המשיכה לחייב את התובע/ת בסך כולל של ${shekels(refundAgorot)} לאחר מועד הביטול.`
      : "למרות הודעת הביטול, הנתבעת המשיכה לחייב את התובע/ת לאחר מועד הביטול (פירוט הסכומים בהתאם לאסמכתאות המצורפות).";

  const remedyLines = [
    refundAgorot > 0
      ? `א. השבה מלאה של הסכומים שנגבו לאחר מועד הביטול, בסך ${shekels(refundAgorot)}.`
      : "א. השבה מלאה של כל הסכומים שנגבו לאחר מועד הביטול, על פי האסמכתאות.",
    `ב. פיצויים לדוגמה לפי ${basis.exemplaryDamagesSection} ל${basis.law}, בסכום שלא יעלה על ${shekels(exemplaryCapAgorot)}, ללא הוכחת נזק — בשיעור שייקבע על ידי בית המשפט הנכבד.`,
    `סך התביעה: ${shekels(requestedTotalAgorot)}${cappedByCeiling ? " (הוגבל לתקרת הסמכות של בית המשפט לתביעות קטנות)" : ""}.`,
  ];

  const claimStatement = [
    "כתב תביעה — בית המשפט לתביעות קטנות",
    "",
    ...partyLines,
    "",
    "מהות התביעה: המשך חיוב בעסקה מתמשכת לאחר הודעת ביטול בכתב",
    "",
    "העובדות:",
    `1. התובע/ת התקשר/ה עם הנתבעת בעסקה מתמשכת עבור ${product}.`,
    `2. ביום ${input.cancelNoticeDateLabel} שלח/ה התובע/ת לנתבעת הודעת ביטול בכתב, בהתאם ל${basis.cancellationSection} ל${basis.law}. הודעה זו כללה גם דרישה בכתב כמשמעותה ב${basis.writtenDemandSection} לחוק.`,
    `3. ${chargedLine}`,
    "",
    "השתלשלות הפניות בכתב:",
    ...timelineLines,
    "",
    "הטיעון המשפטי:",
    `1. ${basis.mustStopChargingSection} ל${basis.law} מחייב עוסק להפסיק את החיובים לאחר הודעת ביטול של עסקה מתמשכת.`,
    `2. המשך גביית תשלומים לאחר הודעת הביטול, בניגוד ל${basis.mustStopChargingSection}, נמנה עם ההפרות המנויות ב${basis.exemplaryDamagesSection} לחוק, שבגינן רשאי בית המשפט לפסוק פיצויים לדוגמה של עד ${shekels(exemplaryCapAgorot)} ללא הוכחת נזק.`,
    `3. התנאי המקדים שב${basis.writtenDemandSection} לחוק — פנייה בכתב לעוסק בדרישה לקיים את חיוביו — התקיים, כמפורט בהשתלשלות הפניות לעיל.`,
    "",
    "הסעדים המבוקשים:",
    ...remedyLines,
    "",
    `${claimant}`,
    "(חתימה ותאריך — להשלמה בעת ההגשה)",
  ].join("\n");

  const evidenceChecklist = [
    ...(right.procedure.evidenceRequired.map((k) => EVIDENCE_LABEL_HE[k] ?? k)),
    "כל התכתובת עם הנתבעת, לרבות מכתבי המעקב והתשובות שהתקבלו (אם התקבלו)",
    "אסמכתה לזהות התובע/ת (בעת ההגשה בלבד)",
  ];

  return {
    title: `תיק תביעות קטנות — ${company} / ${product}`,
    claimStatement,
    evidenceChecklist,
    requestedTotalAgorot,
    cappedByCeiling,
    filingFeeAgorot: smallClaimsFeeAgorot(requestedTotalAgorot),
    filing: {
      url: SMALL_CLAIMS_FILING_URL,
      capAgorot: SMALL_CLAIMS_CAP_AGOROT,
      capAsOf: SMALL_CLAIMS_CAP_AS_OF,
      feeRuleHe: `אגרת הגשה: 1% מסכום התביעה, ולפחות ₪50 (לתביעה זו: ${shekels(smallClaimsFeeAgorot(requestedTotalAgorot))}). ניתן לבקש פטור מאגרה מטעמי מצב כלכלי.`,
      notesHe: [
        `תקרת תביעה קטנה: ${shekels(SMALL_CLAIMS_CAP_AGOROT)} נכון ל-1.1.2026. התקרה מתעדכנת מעת לעת — יש לוודא את הסכום העדכני לפני ההגשה.`,
        "זוהי טיוטה לעיון ולעריכה. את התביעה מגיש/ה התובע/ת בעצמו/ה — זכאי אינו מגיש תביעות ואינו מייצג בבית משפט.",
        "פסיקת פיצויים לדוגמה נתונה לשיקול דעת בית המשפט; אין באמור הבטחה לתוצאה.",
      ],
    },
  };
}
