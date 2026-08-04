/**
 * First-touch partner / campaign attribution from URL params.
 * Signup reads zakai_partner_ref cookie (see middleware.ts).
 *
 * - UTM: utm_source in allowlist + utm_campaign (embed, agent, paid ads).
 * - Short links: ?pref=meta-cancel-il (never use ?ref= — that is user referral on /signup).
 */

export const ATTRIBUTED_UTM_SOURCES = new Set([
  "embed",
  "agent",
  "cpc",
  "paid",
  "social",
  "partner",
]);

export function partnerRefFromSearchParams(searchParams: URLSearchParams): string | null {
  const source = (searchParams.get("utm_source") || "").toLowerCase();
  if (ATTRIBUTED_UTM_SOURCES.has(source)) {
    // Pipe handoff sets ref_agent — prefer it so G8 can attribute agents even
    // when utm_campaign is generic.
    if (source === "agent") {
      const refAgent = searchParams.get("ref_agent")?.trim();
      if (refAgent && refAgent.length >= 2) {
        return `agent-${refAgent}`.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
      }
    }
    const campaign = searchParams.get("utm_campaign")?.trim();
    if (campaign) return campaign.slice(0, 80);
  }

  const pref = searchParams.get("pref")?.trim();
  if (pref && pref.length >= 2) return pref.slice(0, 80);

  return null;
}
