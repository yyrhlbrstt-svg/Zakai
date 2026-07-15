import { setRequestLocale, getTranslations } from "next-intl/server";
import { ElectricityCalculator } from "@/components/ElectricityCalculator";
import { bcp47, type Locale } from "@/i18n/config";

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
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">
        {t("subtitle")}
      </p>
      <ElectricityCalculator bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
