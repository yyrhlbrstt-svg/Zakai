/**
 * Validation for the two fields that go straight into an official letter
 * unchecked today: the Israeli ID and the tax year. A malformed value here
 * doesn't fail loudly — it produces a real letter to the tax authority (or
 * national insurance, or a municipality) that states an invalid ID or a tax
 * year like "6289", which reads as either a typo nobody caught or a person
 * who isn't who they say they are. Both are worse than a blocked button.
 */

/** Standard Israeli teudat zehut checksum (mod-10, doubling every second digit). */
export function isValidIsraeliId(raw: string): boolean {
  const id = raw.trim();
  if (!/^\d{5,9}$/.test(id)) return false;
  const padded = id.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(padded[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * A plausible tax/benefit year: four digits, within a normal filing window.
 * Israeli tax reassessment requests typically reach back a handful of years
 * (open tax years) — 10 years back to 1 year ahead comfortably covers every
 * real case without accepting obvious garbage like "6289".
 */
export function isPlausibleTaxYear(raw: string, now: Date = new Date()): boolean {
  const period = raw.trim();
  if (!/^\d{4}$/.test(period)) return false;
  const year = Number(period);
  const current = now.getFullYear();
  return year >= current - 10 && year <= current + 1;
}

/**
 * A plausible shekel amount for a claim letter ("...בסכום כולל של כ-{amount}").
 * Accepts plain digits with an optional thousands-comma and up to 2 decimal
 * places; rejects non-numeric text and absurd values (a stray extra digit or
 * a pasted phone number) while staying generous enough for a real severance
 * or property-transaction sum.
 */
export function isPlausibleAmount(raw: string): boolean {
  const value = raw.trim();
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(value)) return false;
  const num = Number(value.replace(/,/g, ""));
  return num > 0 && num <= 50_000_000;
}
