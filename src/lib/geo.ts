import { headers } from "next/headers";

/**
 * Best-effort visitor country from edge/CDN headers. Vercel sets
 * `x-vercel-ip-country`; Cloudflare sets `cf-ipcountry`. Returns an uppercase
 * ISO-3166 alpha-2 code (e.g. "IL", "US") or "" when unknown (e.g. local dev).
 *
 * This is the foundation for region-aware content: the language default and,
 * over time, region-specific rights. It never blocks — an unknown country
 * simply falls back to the Israel-first defaults.
 *
 * The `headers()` call is deliberately NOT wrapped in try/catch. During
 * Next.js's static-generation pass, `headers()` throws a special internal
 * signal (not a real error) that Next's own machinery needs to see uncaught
 * so it can correctly mark the route dynamic. A try/catch here used to
 * swallow that signal, which made Next believe every page calling this
 * function (the homepage among them) could be prerendered as static despite
 * `dynamic = "force-dynamic"` — and then crash with a 500
 * ("Dynamic server usage") on every real request in production, because the
 * static shell it built couldn't actually serve the per-request data this
 * function and the page's own DB queries need. In a real request render
 * (the only context this ever actually runs in) `headers()` does not throw.
 */
export async function getCountry(): Promise<string> {
  const h = await headers();
  const c =
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("x-country") ||
    "";
  return c.toUpperCase();
}

export async function isIsrael(): Promise<boolean> {
  const c = await getCountry();
  // Unknown (local dev, or a CDN that doesn't set the header) defaults to
  // Israel — the home market — so nothing regresses without geo data.
  return c === "" || c === "IL";
}
