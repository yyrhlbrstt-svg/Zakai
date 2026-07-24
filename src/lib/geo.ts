import { headers } from "next/headers";

/**
 * Best-effort visitor country from edge/CDN headers. Vercel sets
 * `x-vercel-ip-country`; Cloudflare sets `cf-ipcountry`. Returns an uppercase
 * ISO-3166 alpha-2 code (e.g. "IL", "US") or "" when unknown (e.g. local dev).
 *
 * This is the foundation for region-aware content: the language default and,
 * over time, region-specific rights. It never blocks — an unknown country
 * simply falls back to the Israel-first defaults.
 */
export async function getCountry(): Promise<string> {
  try {
    const h = await headers();
    const c =
      h.get("x-vercel-ip-country") ||
      h.get("cf-ipcountry") ||
      h.get("x-country") ||
      "";
    return c.toUpperCase();
  } catch {
    return "";
  }
}

export async function isIsrael(): Promise<boolean> {
  const c = await getCountry();
  // Unknown (local dev, or a CDN that doesn't set the header) defaults to
  // Israel — the home market — so nothing regresses without geo data.
  return c === "" || c === "IL";
}
