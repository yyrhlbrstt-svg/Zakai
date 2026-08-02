import type { Metadata } from "next";
import { PageKicker } from "@/components/PageKicker";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { LeadForm } from "@/components/LeadForm";
import { LogoMark } from "@/components/Logo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { IntentTriage } from "@/components/IntentTriage";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_start_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/start") },
  };
}

export default async function StartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { locale } = await params;
  const { v } = await searchParams;
  setRequestLocale(locale);

  const vertical = (v || "general").replace(/[^a-z-]/g, "").slice(0, 60) || "general";
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_start_page = await getTranslations({ locale, namespace: "inline_app_locale_start_page" });

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-5">
        <LogoMark size={44} />
        <PageKicker className="mb-0">
          {tIapp_locale_start_page("t_eb8bdcd9")}
        </PageKicker>
      </div>
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.14] m-0 text-balance mb-3">
        {tIapp_locale_start_page("t_b39acbd2")}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-6">
        {tIapp_locale_start_page("t_d8d013b8")}
      </p>

      <IntentTriage />

      <div className="flex flex-col gap-2.5 mb-8">
        <Link href="/money">
          <Button className="w-full !text-[15px] !py-3">
            {tIapp_locale_start_page("t_721693ca")}
          </Button>
        </Link>
        <Link href="/electricity">
          <Button variant="ghost" className="w-full">
            {tIapp_locale_start_page("t_87c0ebfc")}
          </Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost" className="w-full">
            {tIapp_locale_start_page("t_e2ca32d5")}
          </Button>
        </Link>
        <Link href="/bank-fees">
          <Button variant="ghost" className="w-full">
            {tIapp_locale_start_page("t_a5b579f8")}
          </Button>
        </Link>
        <Link href="/what-am-i-owed">
          <Button variant="ghost" className="w-full">
            {tIapp_locale_start_page("t_cb700000")}
          </Button>
        </Link>
        <Link href="/leaks">
          <Button variant="ghost" className="w-full">
            {tIapp_locale_start_page("t_16c6cdf1")}
          </Button>
        </Link>
      </div>

      <LeadForm vertical={vertical} />
    </main>
  );
}
