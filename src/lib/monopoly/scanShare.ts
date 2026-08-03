/**
 * Honest viral copy after statement scan — detection, not documented savings.
 */

export function scanShareKicker(locale: string): string {
  const he = locale === "he" || locale === "ar";
  return he ? "זיהוי חיובים חוזרים" : "Recurring charge scan";
}

export function buildScanShareMessage(
  locale: string,
  opts: { amountLabel: string; recurringCount: number },
): string {
  const he = locale === "he" || locale === "ar";
  const n = Math.max(0, Math.trunc(opts.recurringCount));
  if (he) {
    return `סרקתי את הדוח עם זכאי — זיהיתי ${n} חיובים חוזרים, בערך ${opts.amountLabel} לחודש. בלי סיסמת בנק.`;
  }
  return `I scanned my statement with Zakai — found ${n} recurring charges, about ${opts.amountLabel}/month. No bank password.`;
}

export function scanShareLandingPath(): string {
  return "/money#zakai-money-scan";
}
