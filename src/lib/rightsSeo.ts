import { ENTITLEMENTS } from "@/lib/rights";

const FOREIGN_PREFIX = /^(us|uk|de|fr|ca|au|it)_/;

/** URL slug for an entitlement id, e.g. `tax_refund` → `tax-refund`. */
export function entitlementSlug(id: string): string {
  return id.replace(/_/g, "-");
}

export function entitlementIdFromSlug(slug: string): string | null {
  const id = slug.replace(/-/g, "_");
  return IL_ENTITLEMENT_IDS.has(id) ? id : null;
}

export const IL_ENTITLEMENT_IDS = new Set(
  ENTITLEMENTS.filter((e) => !FOREIGN_PREFIX.test(e.id)).map((e) => e.id),
);

export const IL_RIGHT_SLUGS: string[] = [...IL_ENTITLEMENT_IDS].map(entitlementSlug);
