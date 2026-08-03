import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";

/**
 * Every real path on this site is locale-prefixed (/he/dashboard, not
 * /dashboard) — a bare "/dashboard" entry here never matched a single URL
 * that actually exists, so the private pages it named were never really
 * disallowed. The "/*\/" wildcard (Google, Bing and every crawler that
 * matters support "*" in robots.txt) matches any one locale segment instead.
 */
const PRIVATE_PATHS = [
  "dashboard",
  "settings",
  "assistant",
  "founder",
  "documents",
  "authority",
  "ownership",
  "verify-email",
  "forgot",
  "reset",
];

/**
 * Blanket-disallowed by "/api/" below, then individually re-opened: these are
 * the GET endpoints an institution's automated conformance check (or any bot
 * that respects robots.txt, not only search crawlers) needs to fetch without
 * asking us first. The longest matching rule wins regardless of listing order
 * (Google's and Bing's documented behaviour), so a specific Allow here beats
 * the general /api/ Disallow.
 */
const INSTITUTIONAL_API_PATHS = [
  "/api/mandate/scopes",
  "/api/mandate/openapi.json",
  "/api/mandate/test-vectors",
  "/api/mandate/revocations",
  "/api/settlement/test-vectors",
  "/api/health",
  "/api/pipe",
  "/api/pipe/mark",
  "/api/pipe/handoff",
  "/api/interop",
  "/api/cdn/packs",
  "/api/network/join-kit",
  "/api/network/monopoly",
  "/api/network/indispensability",
  "/api/network/trillion-gates",
  "/api/network/gravity",
  "/api/network/savings-ledger",
  "/api/institution/pilot-package",
  "/api/institution/inbound-receive",
  "/api/institution/ignore-cost",
  "/api/rights/catalog",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", ...INSTITUTIONAL_API_PATHS],
        disallow: ["/api/", ...PRIVATE_PATHS.map((p) => `/*/${p}`)],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
