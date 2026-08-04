import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
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
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
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

export default withNextIntl(nextConfig);
