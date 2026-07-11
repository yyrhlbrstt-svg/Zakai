/**
 * Israeli mobile phone normalization and validation.
 * Canonical storage form is E.164: +9725XXXXXXXX.
 */

/**
 * Normalize common Israeli input forms to E.164, or return null if it is not a
 * valid Israeli mobile number.
 *
 * Accepts: 0501234567, 050-123-4567, +972501234567, 972501234567, 00972...
 * Israeli mobiles are 05X where X ∈ {0,1,2,3,4,5,8} historically; we accept
 * the broad 05X-XXXXXXX shape (10 digits national) to avoid over-rejecting.
 */
export function normalizeIsraeliMobile(input: string): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");

  // 00-prefixed international -> +
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);

  let national: string | null = null;
  if (digits.startsWith("+972")) {
    national = "0" + digits.slice(4);
  } else if (digits.startsWith("972")) {
    national = "0" + digits.slice(3);
  } else if (digits.startsWith("0")) {
    national = digits;
  } else {
    return null;
  }

  // National mobile: 05 followed by 8 digits = 10 chars total.
  if (!/^05\d{8}$/.test(national)) return null;

  return "+972" + national.slice(1);
}

export function isValidIsraeliMobile(input: string): boolean {
  return normalizeIsraeliMobile(input) !== null;
}

/** Mask an E.164 phone for public display: +972501234567 -> +972-50-***-4567 */
export function maskPhone(e164: string): string {
  const normalized = normalizeIsraeliMobile(e164) ?? e164;
  const m = normalized.match(/^\+972(\d{2})(\d{3})(\d{4})$/);
  if (!m) return "***";
  return `+972-${m[1]}-***-${m[3]}`;
}
