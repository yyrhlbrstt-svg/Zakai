import type { MetadataRoute } from "next";
import { activeLocales } from "@/i18n/config";
import { listKnownProviders } from "@/lib/companyScore";
import { IL_RIGHT_SLUGS } from "@/lib/rightsSeo";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";
// A hardcoded locale list here drifted from i18n/config.ts before: when de
// and fr were added as active locales, this sitemap kept listing only the
// original four, so search engines had no discovery path to the German or
// French version of any page. Importing the same source of truth i18n
// routing uses means the two can no longer disagree.
const LOCALES = activeLocales;

const PATHS = [
  "",
  "/money",
  "/leaks",
  "/proofs",
  "/cancel",
  "/cancel/universal",
  "/flights",
  "/partners",
  "/business",
  "/credit-card",
  "/refund-chase",
  "/check",
  "/what-am-i-owed",
  "/rights",
  "/global",
  "/scan",
  "/spending",
  "/pricing",
  "/trust",
  "/institutions",
  "/institutions/leader",
  "/institutions/leaders",
  "/agents",
  "/registry",
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
  "/contract-check",
  "/overtime-backpay",
  "/late-payment",
  "/scam-check",
  "/complaint-escalation",
  "/advance-tax",
  "/school-payments",
  "/vehicle-check",
  "/alimony-guarantee",
  "/arnona",
  "/baggage",
  "/business-compensation",
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
  "/network-proof",
  "/tools",
  "/integrations",
  "/student-loan-overpayment",
  "/wage-statement-audit",
  "/debt-collector-dispute",
  "/train-delay",
  "/consumer-cancel",
  "/toll-dispute",
  "/vehicle-license-refund",
  "/collection-complaint",
  "/car-insurance-refund",
  "/vaad-bait",
  "/water-bill",
  "/landlord-repairs",
  "/duplicate-charge",
  "/bank-loan-fee",
  "/telecom-exit",
  "/holocaust-survivors",
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
  "/go/money",
  "/go/cancel",
  "/go/check",
  "/go/bank-fees",
  "/go/electricity",
  "/go/warranty",
  "/go/deposit",
  "/go/duplicate-insurance",
  "/go/flights",
  "/go/leaks",
  "/transport-fine",
  "/unemployment",
  "/vat",
  "/warranty",
];

// Every known provider gets a real page now (see companies/[provider]/page.tsx —
// MIN_SAMPLE only gates *stats*, not the page's existence), so each is worth
// its own sitemap entry rather than waiting to be discovered via internal links.
const COMPANY_PATHS = listKnownProviders().map((provider) => `/companies/${provider}`);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    for (const path of [...PATHS, ...COMPANY_PATHS]) {
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
    for (const slug of IL_RIGHT_SLUGS) {
      entries.push({
        url: `${SITE}/${locale}/rights/${slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.55,
      });
    }
  }
  return entries;
}
