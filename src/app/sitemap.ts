import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";
const LOCALES = ["he", "en", "ar", "ru"] as const;

const PATHS = [
  "",
  "/money",
  "/leaks",
  "/proofs",
  "/cancel",
  "/flights",
  "/partners",
  "/business",
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
  "/electricity",
  "/taxrefund",
  "/bank-fees",
  // Each of these is a real, indexable content page — a distinct money-recovery
  // vertical with its own copy — that was simply never added here as it shipped.
  // A page not in the sitemap still gets crawled eventually via internal links,
  // but "eventually, maybe" is not the same as being found by the search that
  // was looking for it on day one.
  "/incident",
  "/dormant",
  "/vehicle-check",
  "/arnona",
  "/baggage",
  "/car-value",
  "/child-savings",
  "/class-action",
  "/companies",
  "/compensation-claims",
  "/construction-defects",
  "/deals",
  "/debt-consolidation",
  "/deposit",
  "/disability-benefits",
  "/duplicate-insurance",
  "/entitlements",
  "/insurance-compare",
  "/lost-money",
  "/maternity",
  "/miluim",
  "/mortgage",
  "/mortgage-insurance",
  "/olim",
  "/parking",
  "/payslip",
  "/pension-fees",
  "/price-protection",
  "/results",
  "/score",
  "/severance",
  "/start",
  "/transport-fine",
  "/unemployment",
  "/vat",
  "/warranty",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    for (const path of PATHS) {
      entries.push({
        url: `${SITE}/${locale}${path}`,
        lastModified: now,
        changeFrequency:
          path === "" || path === "/money" || path === "/leaks" || path === "/proofs"
            ? "daily"
            : "weekly",
        priority:
          path === ""
            ? 1
            : path === "/money" || path === "/leaks" || path === "/proofs"
              ? 0.95
              : 0.6,
      });
    }
  }
  return entries;
}
