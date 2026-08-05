/**
 * Building-committee (vaad bait) financial transparency demand — Land Law,
 * 5729-1969 house-committee regulations (חוק המקרקעין, התשכ"ט-1969 — תקנות
 * ועדי בתים; חובת פירוט חיובים), the same citation already registered in
 * this codebase's IL rights catalog (src/lib/global/packs/il.ts). This is a
 * transparency/accounting demand, not a refund claim — the letter never
 * promises a charge will be reduced or reversed, only that the committee
 * must produce reports and an itemized explanation before payment continues.
 */

export interface VaadBaitInput {
  customerName: string;
  buildingAddress: string;
  unexplainedCharge: string;
  chargeAmountShekels?: number;
}

export function buildVaadBaitLetter(input: VaadBaitInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הדייר/ת";
  const address = input.buildingAddress.trim();
  const charge = input.unexplainedCharge.trim();
  const amount =
    input.chargeAmountShekels && input.chargeAmountShekels > 0
      ? `₪${input.chargeAmountShekels.toFixed(2)}`
      : null;

  return {
    subject: `בקשת דוחות כספיים ופירוט חיוב — ועד בית${address ? ` ${address}` : ""}`,
    body: `לכבוד ועד הבית,
${address}

שמי ${name}, דייר/ת בבניין.

קיבלתי חיוב שאינו מוסבר דיו: ${charge || "חיוב שלא צורף לו פירוט"}.
${amount ? `סכום החיוב: ${amount}\n` : ""}
בהתאם לחוק המקרקעין, התשכ"ט-1969 ותקנות ועדי בתים, לדייר זכות לקבל דוחות כספיים ופירוט הוצאות הבית המשותף. אבקש:
1. דוח כספי עדכני של ועד הבית
2. פירוט מלא של החיוב הנדון — מקור, סכום וחלוקה בין הדיירים
3. אסמכתאות (חשבוניות/קבלות) לחיוב, ככל שקיימות

עד לקבלת הפירוט המבוקש, אבקש לעכב את גביית הסכום השנוי במחלוקת.

בכבוד רב,
${name}`,
  };
}
