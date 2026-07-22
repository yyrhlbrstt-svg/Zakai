import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { TaxRefundCalculator } from "@/components/TaxRefundCalculator";
import { TaxEligibilityCheck } from "@/components/TaxEligibilityCheck";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "מחשבון החזר מס — זכאי",
  description:
    "עבדת רק חלק מהשנה? כנראה מגיע לך החזר מס. אומדן מהיר לפי השכר וחודשי העבודה. רץ בדפדפן, בלי מסמכים.",
};

export default async function TaxRefundPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("taxrefund");

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[600px]">{t("subtitle")}</p>
      <TaxEligibilityCheck />
      <TaxRefundCalculator bcp47={bcp47[locale as Locale]} />
    </main>
  );
}
