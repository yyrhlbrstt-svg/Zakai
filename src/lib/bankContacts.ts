/**
 * Public bank complaint / service inboxes for Mandate outreach.
 *
 * Defaults are empty on purpose: inventing a bank@ address that bounces is
 * worse than asking the person for the inbox on their statement. Operations
 * may set BANK_CONTACT_OVERRIDES (JSON map of provider key → email).
 */

function parseOverrides(): Record<string, string> {
  const raw = process.env.BANK_CONTACT_OVERRIDES?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Resolve a known bank contact, or "" when unknown — never invent. */
export function resolveBankContactEmail(bankKeyOrName: string): string {
  const overrides = parseOverrides();
  const key = bankKeyOrName.trim().toLowerCase();
  if (!key) return "";
  if (overrides[key]) return overrides[key];
  for (const [k, v] of Object.entries(overrides)) {
    if (key.includes(k.toLowerCase()) || k.toLowerCase().includes(key)) return v;
  }
  return "";
}
