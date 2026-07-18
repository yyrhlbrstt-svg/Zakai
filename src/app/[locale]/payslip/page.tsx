import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PayslipChecker } from "@/components/PayslipChecker";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "בדיקת תלוש שכר — זכאי",
  description:
    "בדיקה חינמית של תלוש השכר: שכר מינימום, הפרשות פנסיה ודמי הבראה — כמה מגיע לך ומה חסר. רץ בדפדפן, בלי להעלות מסמכים.",
};

/** Public payslip audit — runs in the browser, nothing stored. */
export default async function PayslipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("payslip");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <PayslipChecker bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
