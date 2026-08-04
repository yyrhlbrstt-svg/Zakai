/**
 * Viral share copy for universal cancel — letters ready, user sends.
 */

export function universalCancelShareKicker(locale: string): string {
  const he = locale === "he" || locale === "ar";
  return he ? "מכתבי ביטול מוכנים" : "Ready cancel letters";
}

export function buildUniversalCancelShareMessage(
  locale: string,
  opts: { letterCount: number; amountLabel?: string },
): string {
  const he = locale === "he" || locale === "ar";
  const n = Math.max(0, Math.trunc(opts.letterCount));
  if (he) {
    const amt = opts.amountLabel ? ` — בערך ${opts.amountLabel} לחודש` : "";
    return `הכנתי ${n} מכתבי ביטול עם זכאי${amt}. בלי סיסמת בנק — מעתיקים ושולחים מהמייל שלך.`;
  }
  const amt = opts.amountLabel ? ` — about ${opts.amountLabel}/month` : "";
  return `I prepared ${n} cancel letters with Zakai${amt}. No bank password — copy and send from your own email.`;
}

export function universalCancelSharePath(): string {
  return "/cancel/universal";
}
