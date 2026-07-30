import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import {
  aggregateCompanyStats,
  aggregateProviderVerticalStats,
  type VerticalCaseOutcome,
} from "@/lib/companyScore";
import { getRulePack } from "@/lib/verticals";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export const revalidate = 3600;

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; provider: string }>;
}): Promise<Metadata> {
  const { locale, provider } = await params;
  const t = await getTranslations({ locale, namespace: "companies" });
  const tp = await getTranslations({ locale, namespace: "providers" });
  const name = tp.has(provider) ? tp(provider) : provider;
  return {
    title: `${name} — ${t("metaTitle")}`,
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages(`/companies/${provider}`) },
  };
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

  const outcomes = await loadOutcomes();
  // Same MIN_SAMPLE gate as the /companies list, re-applied here: this route
  // is directly navigable by URL, so a provider that never cleared the list
  // must not become visible just because someone guessed or linked its slug.
  const overall = aggregateCompanyStats(outcomes).find((s) => s.provider === provider);
  if (!overall) notFound();

  const byVertical = aggregateProviderVerticalStats(provider, outcomes);
  const name = tp.has(provider) ? tp(provider) : provider;

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-5">
      <Link href="/companies" className="text-[13px] font-bold text-emerald no-underline">
        ← {t("companies.title")}
      </Link>

      <h1 className="font-display text-[clamp(26px,4.5vw,36px)] leading-tight mt-4 mb-2">{name}</h1>
      <p className="text-ink-soft text-[15px] leading-relaxed mb-6">
        {t("companies.sampleTag", { count: overall.cases })} ·{" "}
        {t("companies.savedRateTag", { pct: overall.savedRatePct })} ·{" "}
        <span className="font-extrabold text-emerald">
          {t("companies.avgTag", { amount: formatAgorot(overall.avgSavingAgorot, loc) })}
        </span>
      </p>

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

      <div className="mt-2 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-5 py-4">
        <p className="text-[13.5px] leading-relaxed m-0 mb-3">{t("companies.institutionNote")}</p>
        <Link href="/institutions" className="text-[13.5px] font-bold text-emerald underline">
          {t("companies.institutionCta")} →
        </Link>
      </div>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] leading-relaxed max-w-[600px]">
        {t("companies.disclaimer")}
      </p>
    </main>
  );
}
