import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { BankFeesTool } from "@/components/BankFeesTool";
import { RightsChecker } from "@/components/RightsChecker";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bankLoanFee" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/bank-loan-fee") },
  };
}

export default async function BankLoanFeePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bankLoanFee");

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")} cite={t("cite")}>
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="IL" />
      <BankFeesTool />
      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.85)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
