import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CreditCardTool } from "@/components/CreditCardTool";

export const metadata: Metadata = {
  title: "ריבית כרטיס אשראי — זכאי",
  description: "כמה עולה היתרה המסתובבת כל חודש — ומה כדאי לעשות.",
};

export default async function CreditCardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-3xl my-3">{he ? "כמה עולה החוב בכרטיס" : "What revolving credit costs"}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">
        {he
          ? "רוב האנשים לא מרגישים את הריבית כל חודש. כאן רואים אותה במספרים — בלי ייעוץ השקעות, רק חישוב."
          : "Most people never see the monthly interest drag. Numbers only — not investment advice."}
      </p>
      <CreditCardTool />
      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.7)]">
        {he
          ? "המספרים להמחשה. תנאי הכרטיס בפועל קובעים."
          : "Illustrative only. Your card terms govern."}
      </p>
    </main>
  );
}
