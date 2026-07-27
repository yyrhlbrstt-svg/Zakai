import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { MoneyHub } from "@/components/MoneyHub";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "הכסף שלי — זכאי",
  description: "ראו מה יורד כל חודש ומה לעשות — בלי סיסמת בנק.",
};

/**
 * Single consumer entry for "what am I paying?" without bank passwords.
 * Screenshot / file → recurring map → in-app actions.
 */
export default async function MoneyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const titles: Record<string, { h: string; s: string }> = {
    he: {
      h: "הכסף שלי",
      s: "זכאי רואה מה יורד לך — ואומר מה לעשות. בלי סיסמת בנק. בלי לקפוץ בין אתרים.",
    },
    en: {
      h: "My money",
      s: "See what leaves every month — and what to do. No bank password. No site-hopping.",
    },
    ar: {
      h: "أموالي",
      s: "اعرف ما يُخصم وما يجب فعله — بدون كلمة مرور للبنك.",
    },
    ru: {
      h: "Мои деньги",
      s: "Что списывается каждый месяц и что делать — без пароля банка.",
    },
  };
  const t = titles[locale] || titles.he;

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t.h}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6 max-w-[560px]">{t.s}</p>
      <MoneyHub bcp47={bcp47[locale as Locale]} screenshotEnabled={aiAvailable()} />
    </main>
  );
}
