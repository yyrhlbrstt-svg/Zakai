/**
 * Public customer-service contact emails for flight compensation outreach.
 * Unknown carriers return "" — never a .example placeholder that could be sent.
 * Operations may set AIRLINE_CONTACT_OVERRIDES (JSON) for extra carriers.
 */

/**
 * One row per carrier: how its name is written, where a claim goes, and the key
 * the outcome graph counts it under.
 *
 * The pattern list and the provider-key list used to be two separate ladders of
 * `if`s over slightly different regexes, and both were Latin-only past the
 * three Israeli carriers. A passenger writing "לופטהנזה" — the ordinary way to
 * write it in the language this product is built in — got no address and a
 * counterparty key of "לופטהנזה", so their outcome landed in a different bucket
 * from the identical claim filed by someone who typed "Lufthansa". That splits
 * the one dataset the strategy engine learns from, quietly, along a line no
 * reader of either list would ever notice. One table, one match.
 */
const AIRLINES: readonly { pattern: RegExp; email: string; key: string }[] = [
  { pattern: /el\s*al|אל[-\s]?על|elal/i, email: "customerservice@elal.co.il", key: "elal" },
  { pattern: /israir|ישראייר/i, email: "info@israir.co.il", key: "israir" },
  { pattern: /arkia|ארקיע/i, email: "service@arkia.co.il", key: "arkia" },
  { pattern: /ryanair|ריינאייר|ריאנאייר/i, email: "customerservice@ryanair.com", key: "ryanair" },
  {
    pattern: /easy\s*jet|easyjet|איזי\s*ג'?ט/i,
    email: "customer.services@easyjet.com",
    key: "easyjet",
  },
  { pattern: /lufthansa|לופטהנזה|לופטהאנזה/i, email: "customer.relations@dlh.de", key: "lufthansa" },
  { pattern: /wizz|ויז\s*אייר|וויז/i, email: "customerservice@wizzair.com", key: "wizz" },
  { pattern: /turkish|turk\s*air|טורקיש|טורקיה/i, email: "feedback@thy.com", key: "turkish" },
  {
    pattern: /british\s*airways|\bba\b|בריטיש/i,
    email: "customerrelations@ba.com",
    key: "britishairways",
  },
  { pattern: /air\s*france|klm|afklm|אייר\s*פראנס/i, email: "contact@airfrance.com", key: "airfrance" },
];

/**
 * The carriers whose claims address we actually hold, offered as a list.
 *
 * The airline used to be a free-text box, and the address for it a field
 * labelled "recommended" that in practice was required — the button that opens
 * the claim stays disabled without one. So a passenger who typed "אל על"
 * correctly got a working form, and a passenger who typed "אל-על", "ELAL" or
 * flew Aegean got a dead screen with no explanation, because nobody knows an
 * airline's compensation inbox off the top of their head. Choosing from what we
 * know turns the common case into two taps and leaves the honest free-text path
 * for everything else.
 *
 * Order is deliberate: Israeli carriers first, then the European ones an
 * Israeli passenger is most likely to be sitting on.
 */
export const KNOWN_AIRLINES: readonly { key: string; he: string; en: string }[] = [
  { key: "elal", he: "אל על", en: "El Al" },
  { key: "israir", he: "ישראייר", en: "Israir" },
  { key: "arkia", he: "ארקיע", en: "Arkia" },
  { key: "wizz", he: "ויז אייר", en: "Wizz Air" },
  { key: "ryanair", he: "ריינאייר", en: "Ryanair" },
  { key: "easyjet", he: "איזי ג'ט", en: "easyJet" },
  { key: "lufthansa", he: "לופטהנזה", en: "Lufthansa" },
  { key: "turkish", he: "טורקיש איירליינס", en: "Turkish Airlines" },
  { key: "britishairways", he: "בריטיש איירווייז", en: "British Airways" },
  { key: "airfrance", he: "אייר פראנס / KLM", en: "Air France / KLM" },
];

function parseOverrides(): Record<string, string> {
  const raw = process.env.AIRLINE_CONTACT_OVERRIDES?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveAirlineContactEmail(airlineLabel: string): string {
  const overrides = parseOverrides();
  const key = airlineLabel.trim().toLowerCase();
  if (overrides[key]) return overrides[key];
  for (const [k, v] of Object.entries(overrides)) {
    if (key.includes(k.toLowerCase())) return v;
  }
  for (const { pattern, email } of AIRLINES) {
    if (pattern.test(airlineLabel)) {
      if (email.includes("@")) return email;
      return `support@${email}`;
    }
  }
  return "";
}

/** Map free-text airline to rule-pack counterparty key when possible. */
export function resolveAirlineProviderKey(airlineLabel: string): string {
  for (const { pattern, key } of AIRLINES) {
    if (pattern.test(airlineLabel)) return key;
  }
  return airlineLabel.trim().slice(0, 80) || "other";
}
