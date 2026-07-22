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

/**
 * International phone normalization to E.164 — the global entry point. Zakai is
 * built to serve anyone whose country it can help, so signup accepts any valid
 * international number, not only Israeli ones.
 *
 * Rules:
 *  - A `+` / `00` international prefix is honored as-is (any country code).
 *  - A bare local number starting with `0` is treated as Israeli (the home
 *    market) for convenience: 05X… → +972…
 *  - Result must be a plausible E.164: `+` then 8–15 digits, first digit 1–9.
 * Returns the E.164 string, or null if it can't be a valid phone number.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");
  if (!digits) return null;

  // 00-prefixed international -> +
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);

  let e164: string;
  if (digits.startsWith("+")) {
    e164 = digits;
  } else if (digits.startsWith("0")) {
    // Bare local number — assume the home market (Israel).
    const il = normalizeIsraeliMobile(digits);
    if (il) return il;
    return null;
  } else {
    // Bare international digits without a plus (e.g. "447700900123").
    e164 = "+" + digits;
  }

  // Plausible E.164: + then 8..15 digits, country code can't start with 0.
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  return e164;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

/**
 * Mask any E.164 phone for public display, keeping the leading digits and the
 * last four: +972501234567 -> +972*****-4567, +14155550123 -> +141****-0123.
 * Country codes are variable-length, so we don't try to parse them precisely.
 */
export function maskPhone(e164: string): string {
  const normalized = normalizePhone(e164) ?? e164;
  const m = normalized.match(/^\+(\d+)$/);
  if (!m || m[1].length < 7) return "***";
  const d = m[1];
  const head = d.slice(0, 3);
  const tail = d.slice(-4);
  return `+${head}${"*".repeat(Math.max(2, d.length - 7))}-${tail}`;
}
