import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MoneyHub } from "@/components/MoneyHub";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_money_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/money") },
  };
}

export default async function MoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tIapp_locale_money_page = await getTranslations({ locale, namespace: "inline_app_locale_money_page" });
  const loc = bcp47[locale as Locale];

  return (
    <VerticalPageShell
      kicker={tIapp_locale_money_page("t_98667843")}
      title={tIapp_locale_money_page("t_2144de53")}
      sub={tIapp_locale_money_page("t_ef77bbd3")}
    >
      <div className="mt-2">
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
    </VerticalPageShell>
  );
}
