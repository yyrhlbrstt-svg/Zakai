import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { CancelTool } from "@/components/CancelTool";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_cancel_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/cancel") },
  };
}

export default async function CancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tIapp_locale_cancel_page = await getTranslations({ locale, namespace: "inline_app_locale_cancel_page" });

  return (
    <VerticalPageShell
      heroGlow
      kicker={tIapp_locale_cancel_page("t_97c08415")}
      title={tIapp_locale_cancel_page("t_9af4e618")}
      sub={tIapp_locale_cancel_page("t_1bb70faa")}
    >
      <div className="flex flex-wrap gap-2.5 mb-6">
        <Link href="/cancel/universal">
          <Button variant="ghost" className="!text-[13px] !py-2">
            {locale === "he" || locale === "ar" ? "ביטול מרוכז (אתם שולחים)" : "Universal cancel (you send)"}
          </Button>
        </Link>
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
    </VerticalPageShell>
  );
}
