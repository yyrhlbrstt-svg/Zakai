import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ElectricityCalculator } from "@/components/ElectricityCalculator";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "electricity" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/electricity") },
  };
}

/** Public page — comparison is value anyone can get; acting comes later. */
export default async function ElectricityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("electricity");

  return (
    <VerticalPageShell kicker={t("kicker")} title={t("title")} sub={t("subtitle")}>
      <ElectricityCalculator bcp47={bcp47[locale as Locale]} />
    </VerticalPageShell>
  );
}
