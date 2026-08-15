import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { aggregateCompanyStats, type CompanyStat } from "@/lib/companyScore";
import { fairnessScoreMap } from "@/lib/services/fairnessScoreMap";
import { providerHebrewName } from "@/lib/providers";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";
import { CompanySearch } from "@/components/CompanySearch";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "companies" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

/** Aggregate real, documented case outcomes per provider. Empty on day one. */
async function loadStats(): Promise<CompanyStat[]> {
  try {
    const cases = await prisma.case.findMany({
      select: { provider: true, status: true, savingsProof: { select: { savingMonthly: true } } },
    });
    return aggregateCompanyStats(
      cases.map((c) => ({
        provider: c.provider,
        saved: c.status === "SAVED" && (c.savingsProof?.savingMonthly ?? 0) > 0,
        savingAgorot: c.savingsProof?.savingMonthly ?? 0,
      })),
    );
  } catch {
    return [];
  }
}

export default async function CompaniesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tp = await getTranslations("providers");
  const loc = bcp47[locale as Locale];
  const stats = await loadStats();
  const fairness = await fairnessScoreMap("IL");

  return (
    <VerticalPageShell
      heroGlow
      kicker={t("companies.kicker")}
      title={t("companies.title")}
      sub={t("companies.sub")}
    >
      {stats.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] p-8 text-center">
          <div className="text-[40px] mb-3">📊</div>
          <div className="font-display text-2xl">{t("companies.emptyTitle")}</div>
          <p className="text-ink-soft text-[14.5px] mt-2 max-w-[440px] mx-auto leading-relaxed">
            {t("companies.emptySub")}
          </p>
          <Link href="/check">
            <Button className="mt-6">{t("companies.emptyCta")}</Button>
          </Link>
          <div className="mt-8 text-start max-w-[480px] mx-auto rounded-xl border border-[rgba(255,255,255,0.08)] p-5">
            <div className="font-extrabold text-[14px] mb-2">{t("companies.emptyFairnessTitle")}</div>
            <p className="text-body text-ink-soft m-0 leading-relaxed">{t("companies.emptyFairnessBody")}</p>
            <a
              href="https://github.com/yyrhlbrstt-svg/Zakai/blob/main/docs/FAIRNESS_CERTIFIED_PROGRAM.md"
              className="inline-block mt-3 text-body font-bold text-emerald"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("companies.emptyFairnessDocs")} →
            </a>
          </div>
        </div>
      ) : (
        <CompanySearch
          placeholder={t("companies.searchPlaceholder")}
          noResults={t("companies.searchNoResults")}
          items={stats.map((s) => ({
            provider: s.provider,
            displayName: tp.has(s.provider) ? tp(s.provider) : providerHebrewName(s.provider),
            sampleLabel: t("companies.sampleTag", { count: s.cases }),
            savedRateLabel: t("companies.savedRateTag", { pct: s.savedRatePct }),
            avgLabel: t("companies.avgTag", { amount: formatAgorot(s.avgSavingAgorot, loc) }),
            fairnessLabel: fairness.get(s.provider)
              ? t("companies.fairnessScoreTag", { score: fairness.get(s.provider)!.fairnessScore })
              : undefined,
          }))}
        />
      )}

      {stats.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-5 py-4">
          <p className="text-[13.5px] leading-relaxed m-0 mb-3">{t("companies.institutionNote")}</p>
          <p className="text-[11.5px] text-ink-soft m-0 mb-3">{t("companies.fairnessScoreHint")}</p>
          <Link href="/institutions" className="text-[13.5px] font-bold text-emerald underline">
            {t("companies.institutionCta")} →
          </Link>
        </div>
      )}

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.85)] leading-relaxed max-w-[600px]">
        {t("companies.disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
