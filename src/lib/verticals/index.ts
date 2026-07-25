import type { CountryCode, VerticalRulePack } from "./types";
import { RULE_PACKS } from "./packs";

export type { CountryCode, VerticalRulePack, ServiceLevel, ServiceChannel, VerificationMethod, VerificationSpec } from "./types";
export { RULE_PACKS } from "./packs";

/** Default market until a user's country routes them elsewhere. */
export const DEFAULT_COUNTRY: CountryCode = "IL";

/**
 * Look up the rule pack for a (vertical, country). Returns null when that
 * combination isn't configured yet — the caller decides how to degrade (e.g.
 * "not available in your country yet"). Adding a market is adding a pack, never
 * editing the core.
 */
export function getRulePack(
  vertical: string,
  country: CountryCode = DEFAULT_COUNTRY,
): VerticalRulePack | null {
  return (
    RULE_PACKS.find((p) => p.key === vertical && p.country === country) ?? null
  );
}

/** All packs for a market (or all packs if no country given). */
export function listRulePacks(country?: CountryCode): VerticalRulePack[] {
  return RULE_PACKS.filter((p) => !country || p.country === country);
}

/** True only for verticals mature enough to act on the user's behalf + charge. */
export function isFullService(vertical: string, country: CountryCode = DEFAULT_COUNTRY): boolean {
  return getRulePack(vertical, country)?.level === "full";
}

/**
 * The effective success-fee rate for a vertical: the pack's override when set,
 * otherwise the user's plan rate. Telecom's override is null, so this returns
 * the plan rate unchanged — the Stage-0 regression invariant.
 */
export function effectiveFeeRateBps(pack: VerticalRulePack | null, planRateBps: number): number {
  return pack?.feeRateBps ?? planRateBps;
}
