import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VatReport } from "@/components/VatReport";
import { LeadCta } from "@/components/LeadCta";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "vat" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/vat") },
  };
}

export default async function VatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("vat");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3 text-balance">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">
        {t("subtitle")}
      </p>
      <VatReport bcp47={bcp47[locale as Locale]} />
      <LeadCta vertical="vat" />
    </main>
  );
}
