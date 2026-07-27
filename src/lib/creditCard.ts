/** Rough revolving-credit cost — educational, not advice. */

export interface CreditCardInput {
  balanceShekels: number;
  annualRatePct: number; // e.g. 12 for 12%
  minPayPct: number; // e.g. 4 for 4% of balance monthly
}

export interface CreditCardResult {
  monthlyInterestShekels: number;
  yearlyInterestShekels: number;
  monthsToClearIfMinOnly: number | null;
  tipHe: string;
  tipEn: string;
}

export function analyzeCreditCard(input: CreditCardInput): CreditCardResult {
  const bal = Math.max(0, input.balanceShekels);
  const annual = Math.max(0, input.annualRatePct) / 100;
  const monthlyRate = annual / 12;
  const monthlyInterest = bal * monthlyRate;
  const minPct = Math.max(1, input.minPayPct) / 100;

  let months: number | null = null;
  if (bal > 0 && monthlyRate >= 0) {
    let b = bal;
    let m = 0;
    while (b > 1 && m < 600) {
      const interest = b * monthlyRate;
      const minPay = Math.max(b * minPct, 50);
      const principal = minPay - interest;
      if (principal <= 0) {
        months = null;
        break;
      }
      b -= principal;
      m++;
    }
    if (months === null && m >= 600) months = null;
    else if (b <= 1) months = m;
  }

  return {
    monthlyInterestShekels: Math.round(monthlyInterest),
    yearlyInterestShekels: Math.round(monthlyInterest * 12),
    monthsToClearIfMinOnly: months,
    tipHe:
      monthlyInterest > 50
        ? "הריבית שוחקת חזק. שקלו פירעון חלקי מהיר או העברה למסלול זול יותר — ואז תעדו חיסכון בזכאי."
        : "היתרה נמוכה יחסית. עדיין כדאי לסגור מהר כדי לא לשלם ריבית מיותרת.",
    tipEn:
      monthlyInterest > 50
        ? "Interest is material. Consider faster pay-down or a cheaper facility — then document the saving in Zakai."
        : "Balance is modest; still worth clearing quickly to avoid idle interest.",
  };
}
