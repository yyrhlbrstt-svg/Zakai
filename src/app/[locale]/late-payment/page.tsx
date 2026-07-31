import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LatePaymentClaim } from "@/components/LatePaymentClaim";
import { alternateLanguages } from "@/lib/seo";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "latePayment" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/late-payment") },
  };
}

export default async function LatePaymentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("latePayment");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <LatePaymentClaim bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
