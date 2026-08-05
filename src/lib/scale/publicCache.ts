/**
 * HTTP cache headers for Class A (public read) API routes.
 */

export type PublicCacheProfile = "immutable" | "catalog" | "live_aggregate" | "no_store";

const PROFILES: Record<PublicCacheProfile, string> = {
  /** JWKS, versioned pack manifests — long TTL, immutable when URL is versioned. */
  immutable: "public, max-age=86400, stale-while-revalidate=604800",
  /** ZML catalog, tool lists — moderate TTL. */
  catalog: "public, max-age=3600, stale-while-revalidate=7200",
  /** Fairness, gravity — short TTL, safe to serve stale while revalidating. */
  live_aggregate: "public, max-age=300, stale-while-revalidate=1800",
  no_store: "no-store",
};

export function cacheControlHeader(profile: PublicCacheProfile): string {
  return PROFILES[profile];
}

export function withPublicCache(
  init: ResponseInit | undefined,
  profile: PublicCacheProfile,
): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", cacheControlHeader(profile));
  return { ...init, headers };
}
