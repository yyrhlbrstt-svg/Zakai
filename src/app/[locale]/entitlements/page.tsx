import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { EntitlementQuiz } from "@/components/EntitlementQuiz";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "entitlementsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/entitlements") },
  };
}

/**
 * The entry funnel: a short, guided "what am I entitled to?" quiz. Runs entirely
 * in the browser over the deterministic rights engine — nothing is stored.
 */
export default async function EntitlementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EntitlementQuiz bcp47={bcp47[locale as Locale]} />;
}
