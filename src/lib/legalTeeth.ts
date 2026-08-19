/**
 * Statutory teeth for cancellation letters — the difference between asking
 * nicely and creating a legal position.
 *
 * THE MECHANISM (verified August 2026 against the statute via nevo.co.il /
 * Kol-Zchut summaries; see also the Knesset bill history of Amendment 26):
 *
 *  - סעיף 13ד לחוק הגנת הצרכן, התשמ"א-1981: a consumer may cancel a
 *    continuing transaction (עסקה מתמשכת — subscriptions, gyms, telecom, TV,
 *    monitoring services…) with a written cancellation notice, and under
 *    13ד(ג) the business must stop charging.
 *  - סעיף 31א(א): for enumerated violations — explicitly including a business
 *    that CONTINUED TO CHARGE after a cancellation notice, contrary to
 *    13ד(ג) — a court MAY award exemplary damages (פיצויים לדוגמה) of up to
 *    ₪10,000 WITHOUT PROOF OF DAMAGE.
 *  - סעיף 31א(ב): the precondition — the consumer must first have approached
 *    the business IN WRITING demanding it meet its obligations. A phone call
 *    to a retention center does not create this position. A documented
 *    written demand does.
 *
 * That last point is why this module exists: every cancellation letter Zakai
 * sends is already a written demand. Saying so explicitly, with the section
 * numbers, costs one paragraph — and turns the letter from a request the
 * provider can ignore into the statutory precondition for a ₪10,000 exposure
 * they have to weigh. Competitors that negotiate by phone cannot produce
 * this artifact at all.
 *
 * HONESTY RULES (non-negotiables #1 and #5 apply):
 *  - The clause states what the statute says ("בית המשפט רשאי") — it never
 *    promises an outcome, an amount, or that a suit will be filed.
 *  - It attaches only to a statutory cancellation (intent "cancel"), never
 *    to commercial asks (retention / downgrade / pause), where citing
 *    exemplary-damages law would be legally wrong and destroy credibility.
 *  - Amounts or provisions not verified against the statute (e.g. enhanced
 *    damages for repeat violations) are NOT cited.
 */

/** The statutory basis, as data — one place to update if the law changes. */
export const CANCEL_TEETH_BASIS = {
  law: "חוק הגנת הצרכן, התשמ\"א-1981",
  cancellationSection: "סעיף 13ד",
  mustStopChargingSection: "סעיף 13ד(ג)",
  exemplaryDamagesSection: "סעיף 31א",
  writtenDemandSection: "סעיף 31א(ב)",
  maxExemplaryShekels: 10_000,
} as const;

/**
 * The paragraph embedded in every statutory cancellation letter (IL market).
 * Establishes: (1) this is a cancellation notice under 13ד; (2) this letter
 * is the written demand 31א(ב) requires; (3) what the statute provides if
 * charging continues anyway.
 */
export function cancelTeethClauseHe(): string {
  const b = CANCEL_TEETH_BASIS;
  return (
    `הודעה זו ניתנת בהתאם ל${b.cancellationSection} ל${b.law}, ` +
    `והיא מהווה פנייה ודרישה בכתב לעניין ${b.writtenDemandSection} לחוק. ` +
    `בהתאם ל${b.mustStopChargingSection}, יש להפסיק את החיובים ממועד הביטול הקבוע בחוק. ` +
    `המשך חיוב לאחר הודעת ביטול זו, בניגוד ל${b.mustStopChargingSection}, ` +
    `נמנה עם ההפרות שבגינן ${b.exemplaryDamagesSection} לחוק מסמיך את בית המשפט לפסוק ` +
    `פיצויים לדוגמה של עד ${b.maxExemplaryShekels.toLocaleString("he-IL")} ₪ ללא הוכחת נזק.`
  );
}

export interface ContinuedBillingFollowUpInput {
  customerName: string;
  company: string;
  product: string;
  /** When the original written cancellation notice was sent (as the user recorded it). */
  cancelNoticeDateLabel: string;
  /** Charges observed after the notice, in shekels — only what the user actually saw. */
  chargedAfterShekels?: number;
}

/**
 * The next rung of the ladder: the provider kept charging after the written
 * cancellation notice. This letter no longer asks — it records the completed
 * statutory position (written demand already made, charging continued) and
 * names the two concrete next steps that exist in the product today:
 * a regulator complaint (complaintEscalation.ts) and small claims.
 */
export function buildContinuedBillingFollowUp(
  input: ContinuedBillingFollowUpInput,
): { subject: string; body: string } {
  const b = CANCEL_TEETH_BASIS;
  const name = input.customerName.trim() || "הלקוח/ה";
  const company = input.company.trim() || "החברה";
  const product = input.product.trim() || "השירות";
  const charged =
    input.chargedAfterShekels && input.chargedAfterShekels > 0
      ? ` בסך כ-₪${Math.round(input.chargedAfterShekels)}`
      : "";

  return {
    subject: `חיוב שנמשך לאחר הודעת ביטול בכתב — ${product} | דרישה להשבה מיידית`,
    body: `לכבוד ${company},

שמי זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם ${name} ובהרשאתו/ה המפורשת (Mandate). אינני הלקוח/ה עצמו/ה.

ביום ${input.cancelNoticeDateLabel} נשלחה אליכם הודעת ביטול בכתב עבור ${product}, בהתאם ל${b.cancellationSection} ל${b.law}. ההודעה כללה דרישה בכתב כמשמעותה ב${b.writtenDemandSection} לחוק.

למרות זאת, נמשכו חיובים לאחר מועד הביטול${charged}.

המשך חיוב לאחר הודעת ביטול, בניגוד ל${b.mustStopChargingSection}, נמנה עם ההפרות שבגינן ${b.exemplaryDamagesSection} לחוק מסמיך את בית המשפט לפסוק פיצויים לדוגמה של עד ${b.maxExemplaryShekels.toLocaleString("he-IL")} ₪ ללא הוכחת נזק — וזאת בנוסף להשבת הסכומים שנגבו.

דרישה: השבה מלאה של כל חיוב שנגבה לאחר מועד הביטול, ואישור בכתב על הפסקת החיובים — בתוך 7 ימי עסקים.

בהיעדר מענה, הצעדים הבאים כבר ערוכים: תלונה ליחידת פניות הציבור של הרגולטור הרלוונטי, והכנת תיק לתביעה בבית המשפט לתביעות קטנות. כל ההתכתבות עד כה מתועדת.

נא מענה בכתב בלבד.

בברכה,
זכאי — סוכן דיגיטלי בשם ${name}`,
  };
}
