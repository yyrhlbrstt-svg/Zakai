import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { RefundChaseTool } from "@/components/RefundChaseTool";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_refund_chase_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/refund-chase") },
  };
}

export default async function RefundChasePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_refund_chase_page = await getTranslations({ locale, namespace: "inline_app_locale_refund_chase_page" });

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-3xl my-3">{tIapp_locale_refund_chase_page("t_adfb9883")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">
        {tIapp_locale_refund_chase_page("t_56976f1e")}
      </p>
      <RefundChaseTool />
    </main>
  );
}
