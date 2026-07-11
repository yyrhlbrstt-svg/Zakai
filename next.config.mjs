import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Financial documents (invoices, statements) are user uploads processed in
  // memory / server-side only. Keep the payload ceiling modest.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default withNextIntl(nextConfig);
