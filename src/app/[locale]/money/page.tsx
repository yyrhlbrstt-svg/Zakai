import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MoneyHub } from "@/components/MoneyHub";
import { MoneyInstallInline } from "@/components/MoneyInstallInline";
import { PriorityActionsRanked } from "@/components/PriorityActionsRanked";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { proofsInboundAddress } from "@/lib/mandate/document";

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
  const proofsEmail = proofsInboundAddress();

  return (
    <VerticalPageShell
      heroGlow
      kicker={tIapp_locale_money_page("t_98667843")}
      title={tIapp_locale_money_page("t_2144de53")}
      sub={tIapp_locale_money_page("t_ef77bbd3")}
    >
      <div className="mt-4 mb-8">
        <div className="font-extrabold text-[14px] mb-3">{tIapp_locale_money_page("priorityTitle")}</div>
        <PriorityActionsRanked limit={3} />
      </div>

      {proofsEmail ? (
        <p className="text-[12px] text-ink-soft leading-relaxed mb-6 border border-[rgba(63,203,155,0.25)] rounded-xl px-4 py-3 bg-[rgba(63,203,155,0.06)]">
          {tIapp_locale_money_page("proofsHint", { email: proofsEmail })}
        </p>
      ) : null}

      <MoneyInstallInline />

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
