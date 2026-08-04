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
      <p className="mb-5 text-[13.5px] text-ink-soft leading-relaxed border border-[rgba(63,203,155,0.28)] rounded-xl px-4 py-3 bg-[rgba(63,203,155,0.06)]">
        {locale === "he" || locale === "ar"
          ? "מסלול סוכן מלא: תיק → Mandate → שליחה → חיסכון מתועד. מתחילים כאן — או מסריקה ב«כסף שלי»."
          : "Full agent path: case → Mandate → send → documented saving. Start here — or from a scan in My money."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          {tIapp_locale_cancel_page("t_2764ad9b")}
        </Link>
      </p>

      <Suspense fallback={<div className="text-ink-soft text-[14px]">{tIapp_locale_cancel_page("t_8447dd09")}</div>}>
        <CancelTool />
      </Suspense>

      <details className="mt-8 text-[13px] text-ink-soft">
        <summary className="cursor-pointer font-bold select-none">
          {locale === "he" || locale === "ar" ? "חלופות (לא הדלת הראשית)" : "Alternatives (not the main door)"}
        </summary>
        <div className="flex flex-wrap gap-2.5 mt-3">
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
        </div>
      </details>
    </VerticalPageShell>
  );
}
