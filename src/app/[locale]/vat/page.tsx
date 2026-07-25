import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VatReport } from "@/components/VatReport";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "דו״ח מע״מ תקופתי לעסקים — זכאי",
  description:
    "בניית דו״ח מע״מ תקופתי בדקה: מע״מ עסקאות מול מע״מ תשומות, איתור תשומות שנחסמות לפי התקנות, ובדיקת מספר הקצאה. רץ בדפדפן — החשבוניות לא עוזבות את המכשיר.",
};

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
    </main>
  );
}
