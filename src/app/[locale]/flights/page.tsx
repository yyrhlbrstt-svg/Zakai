import { setRequestLocale, getTranslations } from "next-intl/server";
import { FlightRightsChecker } from "@/components/FlightRightsChecker";
import { LeadCta } from "@/components/LeadCta";
import { bcp47, type Locale } from "@/i18n/config";

/** Public page — statutory flight-disruption rights under Israeli law. */
export default async function FlightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("flights");

  return (
    <main className="max-w-[680px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">
        {t("subtitle")}
      </p>
      <FlightRightsChecker bcp47={bcp47[locale as Locale]} />
      <LeadCta vertical="flights" />
    </main>
  );
}
