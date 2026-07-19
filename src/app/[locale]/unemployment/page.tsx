import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { UnemploymentCalculator } from "@/components/UnemploymentCalculator";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "מחשבון דמי אבטלה — זכאי",
  description:
    "כמה דמי אבטלה מגיעים לך ולכמה זמן? אומדן לפי השכר והגיל. רץ בדפדפן, בלי מסמכים.",
};

export default async function UnemploymentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("unemployment");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <UnemploymentCalculator bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
