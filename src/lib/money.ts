/**
 * Money is stored and computed in agorot (integer minor units, 1 ₪ = 100).
 * Never represent money as a float in application logic.
 */

export const AGOROT_PER_SHEKEL = 100;

/** Whole-shekel number -> agorot. Rounds to the nearest agora defensively. */
export function shekelsToAgorot(shekels: number): number {
  return Math.round(shekels * AGOROT_PER_SHEKEL);
}

/** Agorot -> shekels as a number (may be fractional). Display only. */
export function agorotToShekels(agorot: number): number {
  return agorot / AGOROT_PER_SHEKEL;
}

/**
 * Format agorot as a localized ₪ string. Whole shekels show no decimals;
 * fractional amounts (e.g. a fee of 666 agorot) show two.
 */
export function formatAgorot(agorot: number, locale = "he-IL"): string {
  const shekels = agorotToShekels(agorot);
  const hasFraction = agorot % AGOROT_PER_SHEKEL !== 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(shekels);
}
