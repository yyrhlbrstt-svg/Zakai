/**
 * Israel Railways delay-compensation demand — the operator's own published
 * passenger compensation procedure (נוהל פיצוי נוסעים של רכבת ישראל), not a
 * statute. Unlike the Montreal Convention's fixed SDR cap, this operator
 * policy's exact thresholds/percentages aren't something this codebase has a
 * verified citation for, so this letter never states a specific formula or
 * amount unless the passenger supplies one themselves — same "never invent
 * a number" discipline as the baggage/landlord-repair letters.
 */

export interface TrainDelayInput {
  customerName: string;
  trainLine: string;
  travelDate: string;
  delayMinutes?: number;
  ticketPriceShekels?: number;
  claimedAmountShekels?: number;
  description?: string;
}

export function buildTrainDelayLetter(input: TrainDelayInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הנוסע/ת";
  const line = input.trainLine.trim();
  const date = input.travelDate.trim();
  const delay =
    input.delayMinutes && input.delayMinutes > 0 ? `${Math.round(input.delayMinutes)} דקות` : null;
  const price =
    input.ticketPriceShekels && input.ticketPriceShekels > 0
      ? `₪${input.ticketPriceShekels.toFixed(2)}`
      : null;
  const claimed =
    input.claimedAmountShekels && input.claimedAmountShekels > 0
      ? `₪${Math.round(input.claimedAmountShekels)}`
      : null;
  const description = input.description?.trim();

  return {
    subject: `דרישת פיצוי בגין עיכוב רכבת${line ? ` — קו ${line}` : ""}`,
    body: `לכבוד שירות לקוחות,
רכבת ישראל

שמי ${name}. נסעתי ברכבת${line ? ` בקו ${line}` : ""} בתאריך ${date}${delay ? `, והנסיעה התעכבה בכ-${delay}` : " וחוויתי עיכוב משמעותי"}.
${price ? `מחיר הכרטיס ששילמתי: ${price}\n` : ""}${description ? `פירוט: ${description}\n` : ""}
בהתאם לנוהל פיצוי הנוסעים המפורסם של רכבת ישראל, אני מבקש/ת לבחון את זכאותי לפיצוי בגין העיכוב.${claimed ? ` להערכתי, הפיצוי הנדרש עומד על כ-${claimed}, בהתאם לנוהל.` : ""}

אבקש:
1. אישור בכתב על קליטת הפנייה
2. בדיקת הזכאות לפיצוי בהתאם לנוהל הפרסום שלכם
3. מענה בכתב תוך זמן סביר

בכבוד רב,
${name}`,
  };
}
