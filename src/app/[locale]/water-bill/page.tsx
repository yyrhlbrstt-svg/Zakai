import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { RightsChecker } from "@/components/RightsChecker";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { WaterBillAgent } from "@/components/WaterBillAgent";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "waterBill" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/water-bill") },
  };
}

export default async function WaterBillPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("waterBill");

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")} cite={t("cite")}>
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="IL" />
      <WaterBillAgent />
    </VerticalPageShell>
  );
}
