import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { UniversalCancelTool } from "@/components/UniversalCancelTool";
import { alternateLanguages } from "@/lib/seo";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "universalCancel" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/cancel/universal") },
  };
}

export default async function UniversalCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("universalCancel");

  return (
    <VerticalPageShell kicker={t("kicker")} title={t("title")} sub={t("sub")} className="max-w-[760px] mx-auto px-5 pb-32 pt-2 relative">
      <UniversalCancelTool bcp47={bcp47[locale as Locale]} />
    </VerticalPageShell>
  );
}
