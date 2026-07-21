/**
 * Region resolution — the foundation for "anyone in the world can use Zakai".
 * We infer the user's country from two signals and combine them: the phone
 * number's international dialing code (precise, tied to the person) and the
 * edge/CDN IP country (available before signup). This lets the rights and
 * language layer adapt per region as Zakai expands beyond Israel.
 *
 * Pure and tested — no I/O here; callers pass the phone and/or IP country.
 */

// International dialing code (E.164 prefix) → ISO-3166 alpha-2. Ordered longest
// prefix first within each lookup so "+972" wins over "+9". Covers Israel plus
// the largest expansion markets; unknown prefixes return "".
const DIAL_TO_COUNTRY: { prefix: string; country: string }[] = [
  { prefix: "972", country: "IL" },
  { prefix: "44", country: "GB" },
  { prefix: "49", country: "DE" },
  { prefix: "33", country: "FR" },
  { prefix: "39", country: "IT" },
  { prefix: "34", country: "ES" },
  { prefix: "31", country: "NL" },
  { prefix: "1", country: "US" }, // US/Canada share +1; default to US
  { prefix: "7", country: "RU" },
  { prefix: "61", country: "AU" },
  { prefix: "971", country: "AE" },
  { prefix: "966", country: "SA" },
  { prefix: "91", country: "IN" },
];

/** Country from an international phone number (any common format), or "". */
export function countryFromPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d+]/g, "");
  // A leading "0" is a national trunk prefix, not an international number —
  // we can't infer the country from it, so defer to other signals.
  if (!digits.startsWith("+") && digits.startsWith("0")) return "";
  const bare = digits.replace(/^\+/, "");
  // Try the longest prefixes first for correctness (e.g. 972 before 9/7).
  const byLen = [...DIAL_TO_COUNTRY].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, country } of byLen) {
    if (bare.startsWith(prefix)) return country;
  }
  return "";
}

/**
 * Combine signals into a best-guess country. Phone wins when present (it's the
 * person), then IP country, else "" (callers treat "" as the home market).
 */
export function resolveCountry(opts: { phone?: string | null; ipCountry?: string | null }): string {
  return countryFromPhone(opts.phone) || (opts.ipCountry || "").toUpperCase();
}

/** Whether a resolved country is the current home market (Israel). */
export function isHomeMarket(country: string): boolean {
  return country === "" || country === "IL";
}
