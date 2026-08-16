import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { buildInsights } from "@/lib/services/insights";
import { getStrategyInsights } from "@/lib/strategy/insights";
import { MIN_SAMPLE } from "@/lib/companyScore";
import { aiAvailable } from "@/lib/ai";
import { planConfig } from "@/lib/plans";
import { AssistantScreen } from "@/components/AssistantScreen";
import { DashboardNextActionPanel } from "@/components/DashboardNextActionPanel";
import { bcp47, type Locale } from "@/i18n/config";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return publicPageMetadata(locale, {
    title: t("assistant.t"),
    description: t("assistant.d"),
    path: "/assistant",
  });
}

export default async function AssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ask?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login?return=/assistant", locale });

  const t = await getTranslations("assistant");
  const insights = await buildInsights(user!.id);
  // Real, gated evidence that the agent actually improves with volume — not
  // a slogan. Same MIN_SAMPLE threshold as every other place this table is
  // read, so this never claims "learning" from a handful of rows.
  const strategyInsights = await getStrategyInsights("IL");
  const learningStat =
    strategyInsights.totalOutcomes >= MIN_SAMPLE
      ? { count: strategyInsights.totalOutcomes, pct: Math.round(strategyInsights.overallWinRate * 100) }
      : null;
  // Seeded from a "draft X for me" button elsewhere (LeadForm.tsx) — a
  // specific promised action, not open text, so a generous cap is fine.
  const { ask } = await searchParams;
  const initialQuestion = ask ? ask.slice(0, 1000) : undefined;

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-2">
      <h1 className="font-display text-3xl my-3">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] leading-relaxed mb-4 max-w-[540px]">
        {t("subtitle")}
      </p>
      {learningStat && (
        <p className="text-[12.5px] text-emerald font-bold mb-4">
          {t("learningStat", { count: learningStat.count, pct: learningStat.pct })}
        </p>
      )}
      {/* Closure first: next action above chat so the agent never becomes a dead-end. */}
      <div className="mb-6">
        <DashboardNextActionPanel userId={user!.id} locale={locale as Locale} />
      </div>
      <AssistantScreen
        insights={insights}
        chatEnabled={aiAvailable()}
        plan={planConfig(user!.plan).id}
        bcp47={bcp47[locale as Locale]}
        initialQuestion={initialQuestion}
      />
    </main>
  );
}
