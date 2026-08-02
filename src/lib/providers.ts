/**
 * Provider registry + free-text Hebrew labels for outreach.
 * Mobile keys are structured; other verticals pass free-text provider names
 * (banks, electricity, airlines) — providerHebrewName resolves those too.
 */
import { resolveAirlineContactEmail } from "@/lib/airlineContacts";
import { resolveTelecomContactEmail } from "@/lib/telecomContacts";

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
  /** Public customer-service inbox (verify on provider site). */
  contactEmail: string;
  category: "mobile";
}

export const PROVIDERS: Record<ProviderKey, ProviderInfo> = {
  cellcom: { key: "cellcom", labelKey: "cellcom", contactEmail: "service@cellcom.co.il", category: "mobile" },
  partner: { key: "partner", labelKey: "partner", contactEmail: "service@partner.co.il", category: "mobile" },
  bezeq: { key: "bezeq", labelKey: "bezeq", contactEmail: "service@bezeq.co.il", category: "mobile" },
  hot: { key: "hot", labelKey: "hot", contactEmail: "service@hotmobile.co.il", category: "mobile" },
  yes: { key: "yes", labelKey: "yes", contactEmail: "service@yes.co.il", category: "mobile" },
  other: { key: "other", labelKey: "other", contactEmail: "", category: "mobile" },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as ProviderKey[];

export const PROVIDER_HE_NAME: Record<ProviderKey, string> = {
  cellcom: "סלקום",
  partner: "פרטנר",
  bezeq: "בזק",
  hot: "הוט",
  yes: "YES",
  other: "הספק",
};

/** Free-text / vertical provider labels used in Case.provider (not only mobile keys). */
const EXTRA_HE: Record<string, string> = {
  electra: "אלקטרה פאוור",
  cellcomEnergy: "סלקום אנרג'י",
  bezeqEnergy: "בזק אנרגיה",
  partnerPower: "פרטנר פאוור",
  hapoalim: "בנק הפועלים",
  leumi: "בנק לאומי",
  discount: "בנק דיסקונט",
  mizrahi: "מזרחי טפחות",
  fibi: "הבינלאומי",
  onezero: "ONE ZERO",
  elal: "אל על",
  israir: "ישראייר",
  arkia: "ארקיע",
  ryanair: "Ryanair",
  easyjet: "easyJet",
  lufthansa: "Lufthansa",
  netflix: "Netflix",
  spotify: "Spotify",
  egged: "אגד",
  dan: "דן",
  metropoline: "מטרופולין",
  municipality: "רשות מקומית",
};

export function providerHebrewName(key: string): string {
  if (isProviderKey(key)) return PROVIDER_HE_NAME[key];
  if (EXTRA_HE[key]) return EXTRA_HE[key];
  // Already a Hebrew / display string from electricity / bank tools
  if (/[\u0590-\u05FF]/.test(key) || key.length > 2) return key;
  return PROVIDER_HE_NAME.other;
}

export function isProviderKey(v: string): v is ProviderKey {
  return v in PROVIDERS;
}

const SUBSCRIPTION_CONTACT: Record<string, string> = {
  netflix: "info@netflix.com",
  spotify: "support@spotify.com",
};

export function providerContactEmail(key: string, vertical?: string): string {
  if (vertical === "airline") return resolveAirlineContactEmail(key);
  if (vertical === "subscription") {
    if (SUBSCRIPTION_CONTACT[key]) return SUBSCRIPTION_CONTACT[key];
    if (isProviderKey(key)) {
      const tel = resolveTelecomContactEmail(key);
      if (tel) return tel;
      const raw = PROVIDERS[key].contactEmail;
      if (raw) return raw;
    }
  }
  if (vertical === "telecom" || !vertical) {
    const tel = resolveTelecomContactEmail(key);
    if (tel) return tel;
  }
  if (isProviderKey(key)) {
    const raw = PROVIDERS[key].contactEmail;
    if (raw) return raw;
  }
  return "";
}

export function resolveProviderKey(name: string): ProviderKey {
  const n = name.trim().toLowerCase();
  if (/(cellcom|סלקום)/.test(n) && !/energy|אנרג/.test(n)) return "cellcom";
  if (/(partner|פרטנר|orange)/.test(n) && !/power|פאוור/.test(n)) return "partner";
  if (/(bezeq|בזק|pelephone|פלאפון)/.test(n) && !/energy|אנרג/.test(n)) return "bezeq";
  if (/(hot|הוט)/.test(n)) return "hot";
  if (/(yes|יס)/.test(n)) return "yes";
  return "other";
}
