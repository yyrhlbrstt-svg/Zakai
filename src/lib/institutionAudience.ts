import { isValidInstitutionSlug } from "@/lib/referenceVerifier";
import { INSTITUTION_PROVIDER_MAP } from "@/lib/institutionInboundPressure";

/**
 * Case.provider keys → Mandate JWT `aud` for institutions that expect a slug.
 * Telecom and other providers keep the raw provider key as audience.
 */
export const PROVIDER_TO_MANDATE_AUDIENCE: Readonly<Record<string, string>> = {
  hapoalim: "bank-hapoalim",
  leumi: "bank-leumi",
  discount: "bank-discount",
  mizrahi: "bank-mizrahi",
  fibi: "bank-fibi",
  onezero: "one-zero",
};

export function resolveMandateAudience(providerKey: string): string {
  const k = providerKey.trim().toLowerCase();
  return PROVIDER_TO_MANDATE_AUDIENCE[k] ?? providerKey;
}

export function isTrackedInstitutionAudience(audience: string): boolean {
  const a = audience.trim().toLowerCase();
  if (a in INSTITUTION_PROVIDER_MAP) return true;
  return isValidInstitutionSlug(a) && a.startsWith("bank-");
}
