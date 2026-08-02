import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LeadCta } from "@/components/LeadCta";
import { DuplicateInsuranceClient } from "@/components/DuplicateInsuranceClient";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "insurance" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function DuplicateInsurancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("insurance");
  const loc = bcp47[locale as Locale];

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      <DuplicateInsuranceClient bcp47={loc} />
      <LeadCta vertical="duplicate-insurance" />

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
