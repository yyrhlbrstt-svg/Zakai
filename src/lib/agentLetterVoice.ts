/**
 * Shared Mandate-disclosing voice for first-round letters.
 * Follow-ups already speak as Zakai; first send must match so provider replies
 * land as written agent outcomes (SavingsProof path), not "who is this?".
 */

/** Opening identity lines — agent, not the customer. */
export function agentLetterOpenHe(customerName: string): string {
  const name = customerName.trim() || "הלקוח/ה";
  return `שמי זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם ${name} ובהרשאתו/ה המפורשת (Mandate). אינני הלקוח/ה עצמו/ה.`;
}

/** Calm professional close with one written ask reminder. */
export function agentLetterCloseHe(customerName: string): string {
  const name = customerName.trim() || "הלקוח/ה";
  return `נא מענה בכתב בלבד.\n\nבברכה,\nזכאי — סוכן דיגיטלי בשם ${name}`;
}
