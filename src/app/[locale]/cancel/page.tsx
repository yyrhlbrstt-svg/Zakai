import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { CancelTool } from "@/components/CancelTool";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "ביטול מנוי / הנחה עם הסוכן — זכאי",
  description:
    "הסוכן של זכאי מבטל מנוי, מבקש הנחה או מקפיא — שולח עם Mandate, עוקב ומתעד חיסכון. בלי מוקד, בלי להשאיר טלפון.",
};

export default async function CancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_cancel_page = await getTranslations({ locale, namespace: "inline_app_locale_cancel_page" });

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-4">
        {tIapp_locale_cancel_page("t_97c08415")}
      </div>
      <h1 className="font-display text-3xl my-3">
        {tIapp_locale_cancel_page("t_9af4e618")}
      </h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-5 max-w-[560px]">
        {tIapp_locale_cancel_page("t_1bb70faa")}
      </p>

      <div className="flex flex-wrap gap-2.5 mb-6">
        <Link href="/money">
          <Button variant="ghost" className="!text-[13px] !py-2">
            {tIapp_locale_cancel_page("t_c700a858")}
          </Button>
        </Link>
        <Link href="/what-am-i-owed">
          <Button variant="ghost" className="!text-[13px] !py-2">
            {tIapp_locale_cancel_page("t_cb700000")}
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="text-ink-soft text-[14px]">{tIapp_locale_cancel_page("t_8447dd09")}</div>}>
        <CancelTool />
      </Suspense>

      <div className="mt-8 rounded-2xl border border-[rgba(63,203,155,0.25)] bg-[rgba(63,203,155,0.06)] px-4 py-4 text-center">
        <p className="text-[13.5px] text-ink-soft m-0 leading-relaxed">
          {tIapp_locale_cancel_page("t_5812ab29")}
        </p>
        <Link href="/money" className="inline-block mt-3 text-emerald font-extrabold text-[14px] no-underline">
          {tIapp_locale_cancel_page("t_2764ad9b")}
        </Link>
      </div>
    </main>
  );
}
