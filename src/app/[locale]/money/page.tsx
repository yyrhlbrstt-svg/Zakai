import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MoneyHub } from "@/components/MoneyHub";
import { Button } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "הכסף שלי — זכאי",
  description: "מפת חיובים ופעולות עם סוכן — בלי סיסמאות בנק. בלי מוקד.",
};

export default async function MoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_money_page = await getTranslations({ locale, namespace: "inline_app_locale_money_page" });
  const loc = bcp47[locale as Locale];

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {tIapp_locale_money_page("t_98667843")}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {tIapp_locale_money_page("t_2144de53")}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[560px]">
        {tIapp_locale_money_page("t_ef77bbd3")}
      </p>

      <div className="mt-8">
        <MoneyHub bcp47={loc} screenshotEnabled={aiAvailable()} />
      </div>

      <div className="mt-10 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-5">
        <div className="font-extrabold text-[14px]">{tIapp_locale_money_page("t_26d7de3c")}</div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Link href="/cancel">
            <Button variant="ghost" className="!text-[13px]">
              {tIapp_locale_money_page("t_bc18d8da")}
            </Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost" className="!text-[13px]">
              {tIapp_locale_money_page("t_a4c2b6a9")}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="!text-[13px]">
              {tIapp_locale_money_page("t_38d0577a")}
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-10 text-[12px] text-ink-soft leading-relaxed">
        {tIapp_locale_money_page("t_3e37c3c8")}
      </p>
    </main>
  );
}
