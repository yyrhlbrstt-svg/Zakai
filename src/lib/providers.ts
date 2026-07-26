/**
 * Provider registry.
 *
 * Stage 1 started with mobile only; electricity is now a full Case category.
 * `contactEmail` is where outreach is dispatched. Placeholder addresses are
 * used in dev (see messaging.ts); production uses confirmed channels.
 */

export type ProviderCategory = "mobile" | "electricity";

export type MobileProviderKey = "cellcom" | "partner" | "bezeq" | "hot" | "yes" | "other";
export type ElectricityProviderKey =
  | "electra"
  | "cellcomEnergy"
  | "bezeqEnergy"
  | "partnerPower"
  | "iec"
  | "otherElectricity";

export type ProviderKey = MobileProviderKey | ElectricityProviderKey;

export interface ProviderInfo {
  key: ProviderKey;
  /** i18n key under `providers.*` for the display name. */
  labelKey: string;
  /** Outreach destination (placeholder in the prototype). */
  contactEmail: string;
  category: ProviderCategory;
}

export const PROVIDERS: Record<ProviderKey, ProviderInfo> = {
  // Mobile
  cellcom: { key: "cellcom", labelKey: "cellcom", contactEmail: "service@cellcom.example", category: "mobile" },
  partner: { key: "partner", labelKey: "partner", contactEmail: "service@partner.example", category: "mobile" },
  bezeq: { key: "bezeq", labelKey: "bezeq", contactEmail: "service@bezeq.example", category: "mobile" },
  hot: { key: "hot", labelKey: "hot", contactEmail: "service@hot.example", category: "mobile" },
  yes: { key: "yes", labelKey: "yes", contactEmail: "service@yes.example", category: "mobile" },
  other: { key: "other", labelKey: "other", contactEmail: "service@provider.example", category: "mobile" },
  // Electricity
  electra: { key: "electra", labelKey: "electra", contactEmail: "service@electra.example", category: "electricity" },
  cellcomEnergy: { key: "cellcomEnergy", labelKey: "cellcomEnergy", contactEmail: "service@cellcom-energy.example", category: "electricity" },
  bezeqEnergy: { key: "bezeqEnergy", labelKey: "bezeqEnergy", contactEmail: "service@bezeq-energy.example", category: "electricity" },
  partnerPower: { key: "partnerPower", labelKey: "partnerPower", contactEmail: "service@partner-power.example", category: "electricity" },
  iec: { key: "iec", labelKey: "iec", contactEmail: "service@iec.example", category: "electricity" },
  otherElectricity: { key: "otherElectricity", labelKey: "otherElectricity", contactEmail: "service@electricity.example", category: "electricity" },
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
  electra: "אלקטרה",
  cellcomEnergy: "סלקום אנרג'י",
  bezeqEnergy: "בזק אנרג'י",
  partnerPower: "פאוור פרטנר",
  iec: "חברת החשמל",
  otherElectricity: "ספק החשמל",
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

export function providerCategory(key: string): ProviderCategory | null {
  return isProviderKey(key) ? PROVIDERS[key].category : null;
}

/**
 * Map a free-text provider name (e.g. from AI extraction) to a known key.
 * Handles Hebrew and English variants; falls back to "other".
 */
export function resolveProviderKey(name: string): ProviderKey {
  const n = name.trim().toLowerCase();
  // Mobile
  if (/(cellcom|סלקום)/.test(n)) return "cellcom";
  if (/(partner|פרטנר|orange)/.test(n)) return "partner";
  if (/(bezeq|בזק|pelephone|פלאפון)/.test(n)) return "bezeq";
  if (/(hot|הוט)/.test(n)) return "hot";
  if (/(yes|יס)/.test(n)) return "yes";
  // Electricity
  if (/(electra|אלקטרה)/.test(n)) return "electra";
  if (/(cellcom energy|סלקום אנרג'י|סלקום אנרגי)/.test(n)) return "cellcomEnergy";
  if (/(bezeq energy|בזק אנרג'י|בזק אנרגי)/.test(n)) return "bezeqEnergy";
  if (/(partner power|פאוור פרטנר|power partner)/.test(n)) return "partnerPower";
  if (/(iec|חברת החשמל|חשמל ישראל)/.test(n)) return "iec";
  return "other";
}

export function resolveElectricityProviderKey(name: string): ElectricityProviderKey {
  const key = resolveProviderKey(name);
  return providerCategory(key) === "electricity" ? (key as ElectricityProviderKey) : "otherElectricity";
}
