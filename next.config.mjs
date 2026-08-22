import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    // src/app/global-not-found.tsx supplies its own <html>/<body> for a path
    // that matches no route at all — there's no root layout.tsx to inherit
    // from (see that file's own comment). Without this flag Next treats a
    // same-shaped app/not-found.tsx as a legacy nested-not-found boundary
    // instead, which cannot mount a second <html> inside one that already
    // rendered: the page ships a 404 status with a fully empty <body>, for
    // both a locale-prefixed typo and a bare unmatched path alike — proven
    // live, not assumed from a changelog entry.
    globalNotFound: true,
  },
  // Serverless NFT otherwise omits the packs tree → /api/cdn/packs 404 in prod.
  outputFileTracingIncludes: {
    "/api/cdn/packs/**/*": ["./zakai-packs/**/*"],
    "/api/cdn/packs": ["./zakai-packs/**/*"],
    "/api/rights/catalog": ["./zakai-packs/**/*"],
  },
  async rewrites() {
    return [
      { source: "/widget/v1.js", destination: "/widget/zakai-widget.js" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Receipt/statement scanning uses the camera in-page (ReceiptCollector,
            // AssistantScreen, MoneyHub) — camera=() blocked that origin entirely.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

/**
 * Sentry wraps the config last, so source maps are uploaded at build time and
 * a production stack trace points at a line of TypeScript rather than at
 * column 40,000 of a minified bundle. That difference is the entire reason to
 * pay for error reporting — an unmapped trace tells you something broke, which
 * you already knew.
 *
 * Wrapped only when an auth token exists. Without one the plugin logs a
 * warning and, more to the point, `next build` in CI would spend time trying
 * to upload maps to nowhere. No token means no upload and an unmodified build.
 */
const withSentry = (config) => {
  if (!process.env.SENTRY_AUTH_TOKEN?.trim()) return config;
  return withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    // The maps are uploaded for Sentry to read and then removed from the
    // deployed output: a public source map hands a reader the whole server
    // codebase, and this one contains the Mandate signing paths.
    sourcemaps: { deleteSourcemapsAfterUpload: true },
    disableLogger: true,
  });
};

export default withSentry(withNextIntl(nextConfig));
