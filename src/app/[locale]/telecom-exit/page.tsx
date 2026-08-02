import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { RightsChecker } from "@/components/RightsChecker";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "telecomExit" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/telecom-exit") },
  };
}

export default async function TelecomExitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("telecomExit");

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")} cite={t("cite")}>
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="IL" />
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link href="/cancel">
          <Button variant="ghost">{t("cancelCta")}</Button>
        </Link>
        <Link href="/money">
          <Button variant="ghost">{t("moneyCta")}</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
