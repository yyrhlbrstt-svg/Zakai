import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PotentialTotal } from "@/components/PotentialTotal";
import { Button } from "@/components/ui";
import { isIsrael } from "@/lib/geo";

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
  const israeliVisitor = await isIsrael();
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_what_am_i_owed_page = await getTranslations({ locale, namespace: "inline_app_locale_what_am_i_owed_page" });

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-5">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {t("kicker")}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,44px)] leading-[1.12] m-0 text-balance">
        {t("title")}
      </h1>
      <p className="text-ink-soft text-[16px] leading-relaxed mt-3 mb-6 max-w-[600px]">{t("sub")}</p>

      <div className="flex flex-wrap gap-2.5 mb-8">
        <Link href="/money">
          <Button className="!text-[13.5px] !px-4 !py-2.5">
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

      <PotentialTotal isIsraeli={israeliVisitor} />

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
    </main>
  );
}
