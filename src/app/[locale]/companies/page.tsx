import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { aggregateCompanyStats, type CompanyStat } from "@/lib/companyScore";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

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

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-5">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {t("companies.kicker")}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-[1.14] m-0 text-balance">
        {t("companies.title")}
      </h1>
      <p className="text-ink-soft text-[16px] leading-relaxed mt-3 mb-8 max-w-[600px]">
        {t("companies.sub")}
      </p>

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
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stats.map((s) => (
            <div
              key={s.provider}
              className="flex items-center gap-4 flex-wrap rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4"
            >
              <div className="flex-1 basis-[160px] font-extrabold text-[15.5px]">
                {tp(s.provider)}
              </div>
              <div className="text-[13px] text-ink-soft">
                {t("companies.sampleTag", { count: s.cases })}
              </div>
              <div className="text-[13px] text-ink-soft">
                {t("companies.savedRateTag", { pct: s.savedRatePct })}
              </div>
              <div className="text-[14px] font-extrabold text-emerald">
                {t("companies.avgTag", { amount: formatAgorot(s.avgSavingAgorot, loc) })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] leading-relaxed max-w-[600px]">
        {t("companies.disclaimer")}
      </p>
    </main>
  );
}
