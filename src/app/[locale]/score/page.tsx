import { getTranslations } from "next-intl/server";
import { ZakaiScoreScreen } from "@/components/ZakaiScoreScreen";
import { VigilWatchCard } from "@/components/VigilWatchCard";
import { bcp47, isLocale, defaultLocale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "score" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function ScorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tag = bcp47[isLocale(locale) ? locale : defaultLocale];
  const t = await getTranslations({ locale, namespace: "score" });

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>
      <ZakaiScoreScreen bcp47={tag} />
      <VigilWatchCard bcp47={tag} />
    </main>
  );
}
