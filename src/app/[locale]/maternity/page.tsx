import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { MaternityCalculator } from "@/components/MaternityCalculator";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "מחשבון דמי לידה — זכאי",
  description:
    "כמה דמי לידה מגיעים לך מביטוח לאומי? חישוב לפי השכר ותקופת האכשרה. רץ בדפדפן, בלי להעלות מסמכים.",
};

export default async function MaternityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("maternity");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <MaternityCalculator bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
