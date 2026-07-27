import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";
const LOCALES = ["he", "en", "ar", "ru"] as const;

const PATHS = [
  "",
  "/money",
  "/leaks",
  "/cancel",
  "/credit-card",
  "/refund-chase",
  "/check",
  "/what-am-i-owed",
  "/rights",
  "/scan",
  "/spending",
  "/pricing",
  "/trust",
  "/institutions",
  "/faq",
  "/signup",
  "/login",
  "/flights",
  "/electricity",
  "/taxrefund",
  "/bank-fees",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    for (const path of PATHS) {
      entries.push({
        url: `${SITE}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" || path === "/money" || path === "/leaks" ? "daily" : "weekly",
        priority: path === "" ? 1 : path === "/money" || path === "/leaks" ? 0.95 : 0.6,
      });
    }
  }
  return entries;
}
