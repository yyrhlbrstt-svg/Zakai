import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { MerchantFeesAgent } from "@/components/MerchantFeesAgent";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "merchantFees" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/merchant-fees") },
  };
}

export default async function MerchantFeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("merchantFees");

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")} cite={t("cite")}>
      <MerchantFeesAgent />
    </VerticalPageShell>
  );
}
