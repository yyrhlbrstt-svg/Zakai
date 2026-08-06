import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PotentialTotal } from "@/components/PotentialTotal";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button } from "@/components/ui";
import { isIsraeliMarket } from "@/lib/geo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "potential" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function WhatAmIOwedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("potential");
  const tEnt = await getTranslations("entitlements");
  const israeliVisitor = await isIsraeliMarket(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_what_am_i_owed_page = await getTranslations({ locale, namespace: "inline_app_locale_what_am_i_owed_page" });

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      {/* The quiz itself is the primary content — it answers on this page with
          no click required to "start." Other tools are secondary, below it. */}
      <PotentialTotal isIsraeli={israeliVisitor} />

      <div className="flex flex-wrap gap-2.5 mt-8 mb-8">
        <Link href="/entitlements">
          <Button variant="ghost" className="!text-[13.5px]">
            {tEnt("start")}
          </Button>
        </Link>
        <Link href="/money">
          <Button variant="ghost" className="!text-[13.5px]">
            {tIapp_locale_what_am_i_owed_page("t_13fc32c9")}
          </Button>
        </Link>
        <Link href="/electricity">
          <Button variant="ghost" className="!text-[13.5px]">
            {tIapp_locale_what_am_i_owed_page("t_0ea869b4")}
          </Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost" className="!text-[13.5px]">
            {tIapp_locale_what_am_i_owed_page("t_e2ca32d5")}
          </Button>
        </Link>
        <Link href="/bank-fees">
          <Button variant="ghost" className="!text-[13.5px]">
            {tIapp_locale_what_am_i_owed_page("t_a5b579f8")}
          </Button>
        </Link>
        <Link href="/leaks">
          <Button variant="ghost" className="!text-[13.5px]">
            {tIapp_locale_what_am_i_owed_page("t_16c6cdf1")}
          </Button>
        </Link>
      </div>

      <div className="mt-10 rounded-2xl border border-[rgba(63,203,155,0.28)] bg-[rgba(63,203,155,0.06)] px-5 py-5 text-center">
        <div className="font-extrabold text-[15px]">
          {tIapp_locale_what_am_i_owed_page("t_b9105fc0")}
        </div>
        <p className="text-ink-soft text-[13.5px] mt-2 max-w-[480px] mx-auto leading-relaxed">
          {tIapp_locale_what_am_i_owed_page("t_7d286052")}
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-4">
          <Link href="/money">
            <Button>{tIapp_locale_what_am_i_owed_page("t_2764ad9b")}</Button>
          </Link>
          <Link href="/start">
            <Button variant="ghost">{tIapp_locale_what_am_i_owed_page("t_b341725e")}</Button>
          </Link>
        </div>
      </div>
    </VerticalPageShell>
  );
}
