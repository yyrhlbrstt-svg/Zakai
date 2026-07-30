import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { TransportFineAppeal } from "@/components/TransportFineAppeal";
import { alternateLanguages } from "@/lib/seo";
import { getVerticalOutcomeStat } from "@/lib/strategy/insights";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transportFine" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/transport-fine") },
  };
}

export default async function TransportFinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("transportFine");
  const stat = await getVerticalOutcomeStat("transport_fine", "transport_operator");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <TransportFineAppeal stat={stat} bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
