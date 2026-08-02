import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { RightsChecker } from "@/components/RightsChecker";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "debtCollectorDispute" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/debt-collector-dispute") },
  };
}

export default async function DebtCollectorDisputePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("debtCollectorDispute");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-4">
        {t("kicker")}
      </div>
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-tight m-0">{t("title")}</h1>
      <p className="text-ink-soft text-[15px] leading-relaxed mt-3 mb-2 max-w-[600px]">{t("sub")}</p>
      <p className="text-[12.5px] text-ink-soft mb-6 max-w-[600px]">{t("cite")}</p>
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="US" />
      <div className="mt-8 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 text-center">
        <p className="text-[14px] font-bold m-0">{t("ilTitle")}</p>
        <p className="text-ink-soft text-[13px] mt-2 mb-4">{t("ilSub")}</p>
        <Link href="/refund-chase">
          <Button>{t("ilCta")}</Button>
        </Link>
      </div>
    </main>
  );
}
