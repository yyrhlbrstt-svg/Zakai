import type { Metadata } from "next";
import { PageKicker } from "@/components/PageKicker";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/Logo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { IntentTriage } from "@/components/IntentTriage";
import { alternateLanguages } from "@/lib/seo";
import { heEn } from "@/lib/heEn";

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
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_start_page = await getTranslations({
    locale,
    namespace: "inline_app_locale_start_page",
  });

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-5">
        <LogoMark size={44} />
        <PageKicker className="mb-0">
          {heEn(he, "התחלה אחת", "One start")}
        </PageKicker>
      </div>
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.14] m-0 text-balance mb-3">
        {heEn(he, "מתחילים ב«כסף שלי»", "Start in My money")}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-6">
        {heEn(
          he,
          "צילום חשבונית → תיק → Mandate → שליחה → חיסכון מתועד. זה הדלת. לא בוחרים מבין עשרות כלים.",
          "Screenshot a bill → case → Mandate → send → documented saving. That is the door. Not a toolbox.",
        )}
      </p>

      <Link href="/money#zakai-money-scan" className="no-underline block mb-6">
        <Button className="w-full !text-[15px] !py-3">
          {tIapp_locale_start_page("t_721693ca")}
        </Button>
      </Link>

      <IntentTriage />

      <details className="mt-2 text-body text-ink-soft">
        <summary className="cursor-pointer font-bold select-none">
          {heEn(he, "כבר יודעים את הבעיה? (אחרי כסף שלי)", "Already know the problem? (after My money)")}
        </summary>
        <div className="flex flex-col gap-2.5 mt-3">
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
          <Link href="/electricity">
            <Button variant="ghost" className="w-full">
              {tIapp_locale_start_page("t_87c0ebfc")}
            </Button>
          </Link>
        </div>
      </details>
    </main>
  );
}
