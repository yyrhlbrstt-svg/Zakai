/**
 * Mortgage refinance ("מִחזוּר משכנתא") savings estimate. A lower interest rate
 * on the remaining balance can save tens of thousands of shekels in interest
 * over the life of the loan. This computes the monthly-payment and total-
 * interest difference between the current rate and an achievable rate on the
 * same balance and remaining term.
 *
 * Standard fixed-rate amortization. This is an ESTIMATE for orientation — real
 * mortgages mix tracks (prime, fixed, index-linked) and carry early-repayment
 * fees; the UI says so and points to a licensed mortgage advisor. Deterministic
 * and fully tested. Shekels (projection, not an exact ledger).
 */
export interface MortgageRefiInput {
  balanceShekels: number; // outstanding principal
  currentAnnualRatePct: number; // current effective annual rate
  newAnnualRatePct: number; // achievable annual rate
  remainingYears: number; // years left on the loan
}

export interface MortgageRefiResult {
  currentMonthlyShekels: number;
  newMonthlyShekels: number;
  monthlySavingShekels: number; // >= 0
  totalInterestSavedShekels: number; // >= 0, over the remaining term
  months: number;
}

/** Fixed-rate monthly payment for principal P over n months at monthly rate r. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function computeMortgageRefi(input: MortgageRefiInput): MortgageRefiResult {
  const balance = Math.max(0, input.balanceShekels);
  const months = Math.max(0, Math.floor(input.remainingYears * 12));
  const cur = Math.max(0, input.currentAnnualRatePct);
  const next = Math.max(0, input.newAnnualRatePct);

  const currentMonthly = monthlyPayment(balance, cur, months);
  const newMonthly = monthlyPayment(balance, next, months);

  const currentTotalInterest = currentMonthly * months - balance;
  const newTotalInterest = newMonthly * months - balance;

  return {
    currentMonthlyShekels: Math.round(currentMonthly),
    newMonthlyShekels: Math.round(newMonthly),
    monthlySavingShekels: Math.max(0, Math.round(currentMonthly - newMonthly)),
    totalInterestSavedShekels: Math.max(0, Math.round(currentTotalInterest - newTotalInterest)),
    months,
  };
}
