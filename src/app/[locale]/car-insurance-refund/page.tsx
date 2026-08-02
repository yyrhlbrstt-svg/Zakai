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
  const t = await getTranslations({ locale, namespace: "carInsuranceRefund" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/car-insurance-refund") },
  };
}

export default async function CarInsuranceRefundPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("carInsuranceRefund");

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")} cite={t("cite")}>
      <RightsChecker bcp47={bcp47[locale as Locale]} defaultCountry="IL" />
      <div className="mt-8 text-center">
        <Link href="/duplicate-insurance">
          <Button variant="ghost">{t("dupCta")}</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
