import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { FdcpaValidationTool } from "@/components/FdcpaValidationTool";
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
  const t = await getTranslations({ locale, namespace: "debtCollectorDispute" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/debt-collector-dispute") },
  };
}

export default async function DebtCollectorDisputePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("debtCollectorDispute");

  return (
    <VerticalPageShell
      heroGlow
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
      cite={t("cite")}
      footer={
        <div className="mt-8 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 text-center">
          <p className="text-[14px] font-bold m-0">{t("ilTitle")}</p>
          <p className="text-ink-soft text-body mt-2 mb-4">{t("ilSub")}</p>
          <Link href="/collection-complaint">
            <Button>{t("ilCta")}</Button>
          </Link>
        </div>
      }
    >
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="US" />
      <FdcpaValidationTool />
    </VerticalPageShell>
  );
}
