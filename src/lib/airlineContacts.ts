/**
 * Public customer-service contact emails for flight compensation outreach.
 * Unknown carriers return "" — never a .example placeholder that could be sent.
 * Operations may set AIRLINE_CONTACT_OVERRIDES (JSON) for extra carriers.
 */

/** Substring match on normalized airline name → contact email. */
const AIRLINE_EMAIL_BY_PATTERN: readonly { pattern: RegExp; email: string }[] = [
  { pattern: /el\s*al|אל על|elal/i, email: "customerservice@elal.co.il" },
  { pattern: /israir|ישראייר/i, email: "info@israir.co.il" },
  { pattern: /arkia|ארקיע/i, email: "service@arkia.co.il" },
  { pattern: /ryanair/i, email: "customerservice@ryanair.com" },
  { pattern: /easy\s*jet|easyjet/i, email: "customer.services@easyjet.com" },
  { pattern: /lufthansa/i, email: "customer.relations@dlh.de" },
  { pattern: /wizz/i, email: "customerservice@wizzair.com" },
  { pattern: /turkish|turk\s*air/i, email: "feedback@thy.com" },
  { pattern: /british\s*airways|\bba\b/i, email: "customerrelations@ba.com" },
  { pattern: /air\s*france|klm|afklm/i, email: "contact@airfrance.com" },
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
  for (const { pattern, email } of AIRLINE_EMAIL_BY_PATTERN) {
    if (pattern.test(airlineLabel)) {
      if (email.includes("@")) return email;
      return `support@${email}`;
    }
  }
  return "";
}

/** Map free-text airline to rule-pack counterparty key when possible. */
export function resolveAirlineProviderKey(airlineLabel: string): string {
  const n = airlineLabel.trim().toLowerCase();
  if (/(el\s*al|אל על|elal)/.test(n)) return "elal";
  if (/israir|ישראייר/.test(n)) return "israir";
  if (/arkia|ארקיע/.test(n)) return "arkia";
  if (/ryanair/.test(n)) return "ryanair";
  if (/easyjet|easy\s*jet/.test(n)) return "easyjet";
  if (/lufthansa/.test(n)) return "lufthansa";
  return airlineLabel.slice(0, 80) || "other";
}
