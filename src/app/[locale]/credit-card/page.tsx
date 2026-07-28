import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { CreditCardTool } from "@/components/CreditCardTool";

export const metadata: Metadata = {
  title: "ריבית כרטיס אשראי — זכאי",
  description: "כמה עולה היתרה המסתובבת כל חודש — ומה כדאי לעשות.",
};

export default async function CreditCardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_credit_card_page = await getTranslations({ locale, namespace: "inline_app_locale_credit_card_page" });

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-3xl my-3">{tIapp_locale_credit_card_page("t_112c2558")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">
        {tIapp_locale_credit_card_page("t_abfc2a7f")}
      </p>
      <CreditCardTool />
      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.7)]">
        {tIapp_locale_credit_card_page("t_5f18186c")}
      </p>
    </main>
  );
}
