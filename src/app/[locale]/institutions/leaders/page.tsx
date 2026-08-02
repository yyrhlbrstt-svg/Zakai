import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { Link } from "@/i18n/routing";
import { ReferenceVerifierLeadersList } from "@/components/ReferenceVerifierLeadersList";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "institutionLeader" });
  return {
    title: t("leadersMetaTitle"),
    description: t("leadersMetaDesc"),
    alternates: { languages: alternateLanguages("/institutions/leaders") },
  };
}

export default async function InstitutionLeadersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "institutionLeader" });

  return (
    <VerticalPageShell
      heroGlow
      kicker={t("leadersKicker")}
      title={t("leadersTitle")}
      sub={t("leadersSub")}
    >
      <EmeraldInfoPanel className="mb-6">
        <p className="m-0 text-[13.5px] leading-relaxed">{t("leadersDisclaimer")}</p>
      </EmeraldInfoPanel>

      <p className="text-[14px] mb-4">
        <Link href="/institutions/leader" className="text-emerald font-bold underline">
          {t("leaderProgramCta")}
        </Link>
      </p>

      <ReferenceVerifierLeadersList locale={locale} />
    </VerticalPageShell>
  );
}
