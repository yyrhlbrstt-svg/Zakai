import { setRequestLocale, getTranslations } from "next-intl/server";
import { RightsChecker } from "@/components/RightsChecker";
import { bcp47, type Locale } from "@/i18n/config";

/** Public — the literal meaning of the brand: are you getting what you're entitled to? */
export default async function RightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rights");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">
        {t("subtitle")}
      </p>
      <RightsChecker bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
