import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { RightsChecker } from "@/components/RightsChecker";
import { RightsCatalogIndex } from "@/components/RightsCatalogIndex";
import { ZmlOpenStandardFooter } from "@/components/ZmlOpenStandardFooter";
import { bcp47, type Locale } from "@/i18n/config";
import { getVisitorMarket } from "@/lib/global/visitorMarket";
import { rightsDefaultCountry } from "@/lib/global/marketGeo";
import { VisitorMarketNotice } from "@/components/VisitorMarketNotice";
import { publicPageMetadata } from "@/lib/seo";

/** Public — the literal meaning of the brand: are you getting what you're entitled to? */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return publicPageMetadata(locale, {
    title: t("rights.t"),
    description: t("rights.d"),
    path: "/rights",
  });
}

export default async function RightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rights");
  const market = await getVisitorMarket();
  const defaultCountry = rightsDefaultCountry(market);

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-2 max-w-[600px]">
        {t("subtitle")}
      </p>
      <VisitorMarketNotice locale={locale} market={market} />
      <RightsChecker
        bcp47={bcp47[locale as Locale]}
        defaultCountry={defaultCountry}
        packMarket={market}
      />
      <RightsCatalogIndex locale={locale} market={market} />
      <ZmlOpenStandardFooter locale={locale} />
    </main>
  );
}
