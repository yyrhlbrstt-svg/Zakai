/**
 * Pension / provident management-fee impact — the largest hidden cost most
 * Israelis carry. Two fees erode savings: a fee on every deposit (דמי ניהול
 * מהפקדה, up to 6% by law) and an annual fee on the accumulated balance (דמי
 * ניהול מצבירה, up to 0.5%). The balance fee compounds over decades, so even a
 * fraction of a percent is worth tens of thousands of shekels by retirement.
 *
 * This projects the balance at retirement under the user's current fees vs a
 * lower (achievable) fee, and reports the gap — the lifetime cost of not
 * negotiating. Returns are an explicit, labeled assumption; the fee rates are
 * the real levers. Deterministic and fully tested. Amounts in shekels
 * (projection, not an exact ledger — the UI frames it as an estimate).
 */
export interface PensionFeesInput {
  balanceShekels: number; // current accumulated savings
  monthlyDepositShekels: number; // total monthly contribution
  years: number; // years until retirement
  currentDepositFeePct: number; // e.g. 2
  currentBalanceFeePct: number; // annual, e.g. 0.3
  targetDepositFeePct: number; // achievable, e.g. 1
  targetBalanceFeePct: number; // achievable, e.g. 0.1
  annualReturnPct?: number; // assumed gross return; default 4
}

export interface PensionFeesResult {
  currentFinalShekels: number;
  targetFinalShekels: number;
  savingsShekels: number; // targetFinal - currentFinal (>= 0)
  years: number;
}

function clampPct(p: number): number {
  if (!Number.isFinite(p) || p < 0) return 0;
  return Math.min(p, 100);
}

/**
 * Month-by-month projection. Each month: add the net deposit (after the deposit
 * fee), apply the monthly gross return, then subtract the monthly share of the
 * annual balance fee.
 */
function project(
  balance: number,
  monthlyDeposit: number,
  months: number,
  annualReturnPct: number,
  depositFeePct: number,
  balanceFeePct: number,
): number {
  const monthlyReturn = annualReturnPct / 100 / 12;
  const monthlyBalanceFee = balanceFeePct / 100 / 12;
  const netDeposit = monthlyDeposit * (1 - depositFeePct / 100);
  let b = balance;
  for (let i = 0; i < months; i++) {
    b += netDeposit;
    b *= 1 + monthlyReturn;
    b *= 1 - monthlyBalanceFee;
  }
  return b;
}

export function computePensionFees(input: PensionFeesInput): PensionFeesResult {
  const years = Math.max(0, Math.floor(input.years));
  const months = years * 12;
  const annualReturnPct = input.annualReturnPct ?? 4;
  const balance = Math.max(0, input.balanceShekels);
  const monthlyDeposit = Math.max(0, input.monthlyDepositShekels);

  const currentFinal = project(
    balance,
    monthlyDeposit,
    months,
    annualReturnPct,
    clampPct(input.currentDepositFeePct),
    clampPct(input.currentBalanceFeePct),
  );
  const targetFinal = project(
    balance,
    monthlyDeposit,
    months,
    annualReturnPct,
    clampPct(input.targetDepositFeePct),
    clampPct(input.targetBalanceFeePct),
  );

  return {
    currentFinalShekels: Math.round(currentFinal),
    targetFinalShekels: Math.round(targetFinal),
    savingsShekels: Math.max(0, Math.round(targetFinal - currentFinal)),
    years,
  };
}
