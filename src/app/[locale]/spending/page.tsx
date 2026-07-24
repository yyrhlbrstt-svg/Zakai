import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SpendingOverview } from "@/components/SpendingOverview";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "spending" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

/**
 * "Where does my money go?" — a universal, license-free spending overview. No
 * login required and country-agnostic: it categorises a statement the user
 * pastes, entirely client-side. The daily-habit hook that brings people back.
 */
export default async function SpendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("spending");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <SpendingOverview bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
