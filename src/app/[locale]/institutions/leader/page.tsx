import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { Link } from "@/i18n/routing";
import { ReferenceVerifierWizard } from "@/components/ReferenceVerifierWizard";
import { InstitutionConformancePanel } from "@/components/InstitutionConformancePanel";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "institutionLeader" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/institutions/leader") },
  };
}

export default async function InstitutionLeaderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "institutionLeader" });

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      <EmeraldInfoPanel className="mb-6">
        <strong className="text-emerald">{t("disclaimerTitle")}</strong>
        <p className="mt-2 mb-0 text-[13.5px] leading-relaxed">{t("disclaimerBody")}</p>
      </EmeraldInfoPanel>

      <ul className="list-disc ps-5 flex flex-col gap-2 text-[14px] leading-relaxed mb-2">
        <li>{t("benefit1")}</li>
        <li>{t("benefit2")}</li>
        <li>{t("benefit3")}</li>
      </ul>

      <p className="text-[13px] text-ink-soft mb-2">
        <Link href="/institutions/leaders" className="text-emerald underline font-bold">
          {t("seeLeaders")}
        </Link>
        {" · "}
        <Link href="/integrations" className="text-emerald underline">
          {t("integrationsLink")}
        </Link>
      </p>

      <InstitutionConformancePanel />

      <ReferenceVerifierWizard />
    </VerticalPageShell>
  );
}
