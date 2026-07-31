import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { OvertimeBackPayCalculator } from "@/components/OvertimeBackPayCalculator";
import { alternateLanguages } from "@/lib/seo";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "overtimeBackPay" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/overtime-backpay") },
  };
}

export default async function OvertimeBackPayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("overtimeBackPay");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <OvertimeBackPayCalculator bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
