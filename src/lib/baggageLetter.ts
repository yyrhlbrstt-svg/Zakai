/**
 * Baggage delay/loss claim letter — Montreal Convention Article 17/19, cap
 * 1,131 SDR per Montreal 1999 as most recently revised (~$1,600–2,175
 * depending on the SDR/USD rate; the cap moves with the exchange rate, so
 * this deliberately never hardcodes a fixed ₪/$ figure — the /baggage page's
 * own copy already states this same real, currently-cited cap).
 */

export interface BaggageClaimInput {
  customerName: string;
  airline: string;
  pirNumber: string;
  flightDate: string;
  disruptionType: "delayed" | "lost";
  essentialPurchasesShekels?: number;
  description?: string;
}

export function buildBaggageClaimLetter(input: BaggageClaimInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const airline = input.airline.trim() || "חברת התעופה";
  const pir = input.pirNumber.trim();
  const date = input.flightDate.trim();
  const amt =
    input.essentialPurchasesShekels && input.essentialPurchasesShekels > 0
      ? `₪${Math.round(input.essentialPurchasesShekels)}`
      : null;
  const description = input.description?.trim();

  const eventLine =
    input.disruptionType === "lost"
      ? `הכבודה שלי בטיסה מתאריך ${date} אבדה ולא אותרה.`
      : `הכבודה שלי בטיסה מתאריך ${date} עוכבה ונמסרה לי באיחור.`;

  return {
    subject: `דרישת פיצוי בגין ${input.disruptionType === "lost" ? "אובדן" : "עיכוב"} כבודה — PIR ${pir || "____"}`,
    body: `לכבוד שירות הלקוחות,
${airline}

שמי ${name}. ${eventLine}
${pir ? `מספר דוח אובדן/עיכוב כבודה (PIR): ${pir}\n` : ""}${description ? `פירוט: ${description}\n` : ""}
בהתאם לאמנת מונטריאול, אני זכאי/ת לפיצוי על ההוצאות החיוניות שנגרמו לי כתוצאה מכך, עד לתקרת האמנה (1,131 יחידות זכויות משיכה מיוחדות, SDR).${amt ? ` ההוצאות החיוניות שנגרמו לי עד כה מסתכמות בכ-${amt}, ואצרף קבלות.` : ""}

אבקש:
1. אישור בכתב על קליטת התביעה
2. פירוט לוח הזמנים לטיפול ולתשלום
3. אם התביעה נדחית — נימוק מפורט בכתב

תגובה בכתב תוך זמן סביר תוערך.

בכבוד רב,
${name}`,
  };
}
