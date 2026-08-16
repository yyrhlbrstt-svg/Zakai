import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import {
  aggregateCompanyStats,
  aggregateProviderVerticalStats,
  aggregateActivePressure,
  listKnownProviders,
  type VerticalCaseOutcome,
} from "@/lib/companyScore";
import { getRulePack, RULE_PACKS } from "@/lib/verticals";
import { providerHebrewName } from "@/lib/providers";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { fairnessScoreMap } from "@/lib/services/fairnessScoreMap";
import { getStrategyInsights } from "@/lib/strategy/insights";

export const revalidate = 3600;

// Every vertical this provider could plausibly be chased through, with the
// page that starts that check. Static (rule-pack config), so listing it here
// makes no claim about the company — only about which category it's in.
const VERTICAL_HREF: Record<string, string> = {
  telecom: "/check",
  "bank-fees": "/bank-fees",
  subscription: "/cancel",
  airline: "/flights",
  "refund-chase": "/refund-chase",
  parking: "/parking",
  "transport-fine": "/transport-fine",
  electricity: "/electricity",
  "late-payment": "/late-payment",
};

/** Same de-identified aggregate the /companies list reads, just not re-grouped by provider yet. */
async function loadOutcomes(): Promise<VerticalCaseOutcome[]> {
  try {
    const cases = await prisma.case.findMany({
      select: { provider: true, vertical: true, status: true, savingsProof: { select: { savingMonthly: true } } },
    });
    return cases.map((c) => ({
      provider: c.provider,
      vertical: c.vertical,
      saved: c.status === "SAVED" && (c.savingsProof?.savingMonthly ?? 0) > 0,
      savingAgorot: c.savingsProof?.savingMonthly ?? 0,
    }));
  } catch {
    return [];
  }
}

/** How many cases are currently open against each provider — separate query, cheap (status only). */
async function loadActivePressure(): Promise<{ provider: string; status: string }[]> {
  try {
    return await prisma.case.findMany({ select: { provider: true, status: true } });
  } catch {
    return [];
  }
}

/** Real display name for any known provider — registry translation first, then the Hebrew name every outreach email already uses, never the raw slug. */
function displayName(tp: Awaited<ReturnType<typeof getTranslations<"providers">>>, provider: string): string {
  return tp.has(provider) ? tp(provider) : providerHebrewName(provider);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; provider: string }>;
}): Promise<Metadata> {
  const { locale, provider } = await params;
  const t = await getTranslations({ locale, namespace: "companies" });
  const tp = await getTranslations({ locale, namespace: "providers" });
  const name = displayName(tp, provider);
  return {
    title: `${name} — ${t("metaTitle")}`,
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages(`/companies/${provider}`) },
  };
}

export function generateStaticParams() {
  return listKnownProviders().map((provider) => ({ provider }));
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; provider: string }>;
}) {
  const { locale, provider } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tp = await getTranslations("providers");
  const loc = bcp47[locale as Locale];

  // A slug nobody recognizes (not a mobile provider, not any rule pack's
  // counterparty) is not a page — never index a name we didn't validate.
  if (!listKnownProviders().includes(provider)) notFound();

  const outcomes = await loadOutcomes();
  const fairness = (await fairnessScoreMap("IL")).get(provider);
  // MIN_SAMPLE still gates any *stat* about this provider — see companyScore.ts.
  // It no longer gates the page's existence: the categories a provider
  // appears in are static rule-pack config, not a data-driven claim, so a
  // provider below the sample threshold still gets a real, indexable, purely
  // factual page instead of a 404 — the whole point of listing it here.
  const overall = aggregateCompanyStats(outcomes).find((s) => s.provider === provider);
  const activePressure = aggregateActivePressure(await loadActivePressure()).find(
    (s) => s.provider === provider,
  );
  const byVertical = aggregateProviderVerticalStats(provider, outcomes);
  const name = displayName(tp, provider);
  const verticalsForProvider = RULE_PACKS.filter((p) => p.counterparties.includes(provider));
  // Which written approach actually won more often against this specific
  // counterparty — already computed for the private dashboard
  // (StrategyInsightsCard) but never surfaced on the one page that can turn
  // it into outside pressure. Same sample gate as everywhere else this table
  // is read (see strategy/insights.ts's own MIN_TRIALS) — never a claim
  // below the honesty threshold.
  const bestApproach = (await getStrategyInsights("IL")).counterparties.find(
    (c) => c.counterparty === provider && c.bestVariantLabelHe,
  );

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-5">
      <Link href="/companies" className="text-body font-bold text-emerald no-underline">
        ← {t("companies.title")}
      </Link>

      <h1 className="font-display text-[clamp(26px,4.5vw,36px)] leading-tight mt-4 mb-2">{name}</h1>

      {fairness && (
        <p className="text-[14px] text-ink-soft mb-4">
          {t("companies.fairnessScoreTag", { score: fairness.fairnessScore })} ·{" "}
          <span className="text-[12px]">{t("companies.fairnessScoreHint")}</span>
        </p>
      )}

      {overall ? (
        <p className="text-ink-soft text-[15px] leading-relaxed mb-6">
          {t("companies.sampleTag", { count: overall.cases })} ·{" "}
          {t("companies.savedRateTag", { pct: overall.savedRatePct })} ·{" "}
          <span className="font-extrabold text-emerald">
            {t("companies.avgTag", { amount: formatAgorot(overall.avgSavingAgorot, loc) })}
          </span>
        </p>
      ) : (
        <p className="text-ink-soft text-[15px] leading-relaxed mb-6">
          {t("companies.noDataYet", { name })}
        </p>
      )}

      {activePressure && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-4 py-3 mb-6 text-[13.5px]">
          <span className="font-extrabold text-emerald">
            {t("companies.activePressure", { count: activePressure.activeCases })}
          </span>
        </div>
      )}

      {!overall && verticalsForProvider.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 mb-6">
          <h2 className="font-display text-lg mb-3">{t("companies.checkCategoriesTitle")}</h2>
          <div className="flex flex-col gap-2">
            {verticalsForProvider.map((pack) => {
              const href = VERTICAL_HREF[pack.key];
              const row = (
                <div className="flex-1 basis-[140px] font-bold text-[14px]">{pack.label}</div>
              );
              return href ? (
                <Link
                  key={pack.key}
                  href={href}
                  className="flex items-center gap-4 flex-wrap rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3 no-underline text-ink hover:border-[rgba(63,203,155,0.35)] transition-colors"
                >
                  {row}
                  <span className="text-[12.5px] text-emerald font-bold">{t("companies.startCheck")} →</span>
                </Link>
              ) : (
                <div
                  key={pack.key}
                  className="flex items-center gap-4 flex-wrap rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3"
                >
                  {row}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {byVertical.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 mb-6">
          <h2 className="font-display text-lg mb-3">{t("companies.byVerticalTitle")}</h2>
          <div className="flex flex-col gap-2">
            {byVertical.map((v) => {
              const label = getRulePack(v.vertical)?.label ?? v.vertical;
              return (
                <div
                  key={v.vertical}
                  className="flex items-center gap-4 flex-wrap rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3"
                >
                  <div className="flex-1 basis-[140px] font-bold text-[14px]">{label}</div>
                  <div className="text-[12.5px] text-ink-soft">
                    {t("companies.sampleTag", { count: v.cases })}
                  </div>
                  <div className="text-[12.5px] text-ink-soft">
                    {t("companies.savedRateTag", { pct: v.savedRatePct })}
                  </div>
                  <div className="text-[13.5px] font-extrabold text-emerald">
                    {t("companies.avgTag", { amount: formatAgorot(v.avgSavingAgorot, loc) })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bestApproach && (bestApproach.bestVariantLabelHe || bestApproach.bestVariantLabelEn) && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 mb-6">
          <h2 className="font-display text-lg mb-2">{t("companies.bestApproachTitle")}</h2>
          <p className="text-[14px] leading-relaxed m-0">
            {t("companies.bestApproachFact", {
              label:
                (locale === "he" ? bestApproach.bestVariantLabelHe : bestApproach.bestVariantLabelEn) ?? "",
              pct: Math.round(bestApproach.winRate * 100),
              trials: bestApproach.trials,
            })}
          </p>
        </div>
      )}

      <div className="mt-2 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-5 py-4">
        <p className="text-[13.5px] leading-relaxed m-0 mb-3">{t("companies.institutionNote")}</p>
        <Link href="/institutions" className="text-[13.5px] font-bold text-emerald underline">
          {t("companies.institutionCta")} →
        </Link>
      </div>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.85)] leading-relaxed max-w-[600px]">
        {t("companies.disclaimer")}
      </p>
    </main>
  );
}
