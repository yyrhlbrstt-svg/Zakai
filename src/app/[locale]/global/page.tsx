import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { GlobalMarketPicker } from "@/components/GlobalMarketPicker";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { allMarkets } from "@/lib/global/registry";
import { CATALOG_ONLY_MARKETS } from "@/lib/global/marketGeo";
import { getVisitorMarket } from "@/lib/global/visitorMarket";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "global" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/global") },
  };
}

export default async function GlobalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "global" });
  const currentMarket = await getVisitorMarket();

  const markets = [
    ...allMarkets().map((m) => ({
      code: m.code,
      label: m.label,
      capabilities: ["rights_engine", "letters", "zml_catalog"] as const,
    })),
    ...Object.entries(CATALOG_ONLY_MARKETS).map(([code, meta]) => ({
      code,
      label: meta.label,
      capabilities: ["zml_catalog"] as const,
    })),
  ].sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <VerticalPageShell title={t("title")} sub={t("intro")} width="wide">
      <GlobalMarketPicker markets={markets} currentMarket={currentMarket} />

      <div className="grid gap-4 mt-10 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-bold m-0 mb-2">{t("apiTitle")}</h2>
          <p className="text-body text-ink-soft m-0 mb-3">{t("apiBody")}</p>
          <a
            href={`${SITE_URL}/api/markets`}
            className="text-body font-bold text-emerald no-underline hover:underline"
            rel="noopener noreferrer"
          >
            {SITE_URL}/api/markets
          </a>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-bold m-0 mb-2">{t("contributeTitle")}</h2>
          <p className="text-body text-ink-soft m-0 mb-3">{t("contributeBody")}</p>
          <Link
            href="/integrations"
            className="text-body font-bold text-emerald no-underline hover:underline"
          >
            {t("contributeCta")}
          </Link>
        </Card>
      </div>
    </VerticalPageShell>
  );
}
