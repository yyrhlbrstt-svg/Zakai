/**
 * Provider registry — Stage 1 is mobile only (spec: one category first).
 *
 * `contactEmail` is where outreach is dispatched. These are placeholders for
 * the prototype; a production deployment would confirm the correct
 * cancellations/retention channel per carrier. Outreach never leaves the system
 * in dev anyway (see messaging.ts), so no placeholder address is ever mailed.
 */

export type ProviderKey =
  | "cellcom"
  | "partner"
  | "bezeq"
  | "hot"
  | "yes"
  | "other";

export interface ProviderInfo {
  key: ProviderKey;
  /** i18n key under `providers.*` for the display name. */
  labelKey: string;
  /** Outreach destination (placeholder in the prototype). */
  contactEmail: string;
  category: "mobile";
}

export const PROVIDERS: Record<ProviderKey, ProviderInfo> = {
  cellcom: { key: "cellcom", labelKey: "cellcom", contactEmail: "service@cellcom.example", category: "mobile" },
  partner: { key: "partner", labelKey: "partner", contactEmail: "service@partner.example", category: "mobile" },
  bezeq: { key: "bezeq", labelKey: "bezeq", contactEmail: "service@bezeq.example", category: "mobile" },
  hot: { key: "hot", labelKey: "hot", contactEmail: "service@hot.example", category: "mobile" },
  yes: { key: "yes", labelKey: "yes", contactEmail: "service@yes.example", category: "mobile" },
  other: { key: "other", labelKey: "other", contactEmail: "service@provider.example", category: "mobile" },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as ProviderKey[];

/**
 * Hebrew display names, used server-side for outreach text (the provider reads
 * Hebrew) and recommendation strategy, independent of the user's UI locale.
 */
export const PROVIDER_HE_NAME: Record<ProviderKey, string> = {
  cellcom: "סלקום",
  partner: "פרטנר",
  bezeq: "בזק",
  hot: "הוט",
  yes: "YES",
  other: "הספק",
};

export function providerHebrewName(key: string): string {
  return isProviderKey(key) ? PROVIDER_HE_NAME[key] : PROVIDER_HE_NAME.other;
}

export function isProviderKey(v: string): v is ProviderKey {
  return v in PROVIDERS;
}

export function providerContactEmail(key: string): string {
  return isProviderKey(key) ? PROVIDERS[key].contactEmail : PROVIDERS.other.contactEmail;
}

/**
 * Map a free-text provider name (e.g. from AI extraction) to a known key.
 * Handles Hebrew and English variants; falls back to "other".
 */
export function resolveProviderKey(name: string): ProviderKey {
  const n = name.trim().toLowerCase();
  if (/(cellcom|סלקום)/.test(n)) return "cellcom";
  if (/(partner|פרטנר|orange)/.test(n)) return "partner";
  if (/(bezeq|בזק|pelephone|פלאפון)/.test(n)) return "bezeq";
  if (/(hot|הוט)/.test(n)) return "hot";
  if (/(yes|יס)/.test(n)) return "yes";
  return "other";
}
