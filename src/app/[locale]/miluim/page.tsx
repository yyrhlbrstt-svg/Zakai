import { setRequestLocale, getTranslations } from "next-intl/server";
import { MiluimCalculator } from "@/components/MiluimCalculator";
import { bcp47, type Locale } from "@/i18n/config";

/** Public — reserve-duty pay: the most under-claimed money in Israel today. */
export default async function MiluimPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("miluim");

  return (
    <main className="max-w-[680px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">
        {t("subtitle")}
      </p>
      <MiluimCalculator bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
