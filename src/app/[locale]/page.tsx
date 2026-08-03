import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { PageKicker } from "@/components/PageKicker";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Globe, ScanLine } from "lucide-react";
import { isIsrael, getCountry } from "@/lib/geo";
import { bcp47, type Locale } from "@/i18n/config";
import { DoorTracker } from "@/components/DoorTracker";
import { provenSavings } from "@/lib/services/selfReportedSaving";
import { LiveGravityStrip } from "@/components/LiveGravityStrip";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";

/**
 * Without this, a search engine sees four unrelated pages at the same content
 * — one per locale — rather than four language variants of one page, which is
 * exactly the signal duplicate-content and cross-language ranking dilution
 * come from. `x-default` matters as much as the four explicit tags: it is
 * what a search engine falls back to for a language it has no better match
 * for, and an absent one means that visitor gets no signal at all rather than
 * the sane default.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      languages: {
        he: `${SITE_URL}/he`,
        en: `${SITE_URL}/en`,
        ar: `${SITE_URL}/ar`,
        ru: `${SITE_URL}/ru`,
        de: `${SITE_URL}/de`,
        fr: `${SITE_URL}/fr`,
        "x-default": `${SITE_URL}/he`,
      },
    },
  };
}

/**
 * Honest loop gravity only — never invent traction. provenSavings() keeps
 * verified vs self-reported apart so the homepage cannot wear a fake receipt.
 */
async function loadLoopGravity() {
  const [proof, sentCount, mandateCount] = await Promise.all([
    provenSavings(),
    prisma.case.count({ where: { status: { in: ["SENT", "SAVED"] } } }).catch(() => 0),
    prisma.authorization
      .count({ where: { status: "ACTIVE", revokedAt: null } })
      .catch(() => 0),
  ]);
  return {
    monthlyAgorot: proof.verifiedMinor,
    count: proof.verifiedCount,
    sentCount,
    mandateCount,
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const gravity = await loadLoopGravity();

  const steps = ["upload", "act", "pay"] as const;
  const trust = (t.raw("home.trust") as string[]) || [];
  const israeliVisitor = await isIsrael();
  const visitorCountry = await getCountry();

  let countryTag = "";
  if (visitorCountry) {
    try {
      const name = new Intl.DisplayNames([locale], { type: "region" }).of(visitorCountry);
      if (name) countryTag = " · " + name;
    } catch {
      // ignore
    }
  }

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      {!israeliVisitor && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[rgba(62,198,255,0.28)] bg-[rgba(62,198,255,0.06)] px-5 py-3.5 text-[13.5px] text-ink-soft leading-relaxed">
          <Globe size={18} className="shrink-0 text-[#3ec6ff]" aria-hidden />
          <span>{t("home.geoNote")}</span>
        </div>
      )}

      {/* First viewport = one start: brand signal + headline + money CTA + money door. */}
      <div className="mb-6 max-w-[640px]">
        <Reveal>
          <PageKicker className="mb-6">
            {t("home.kicker")}
            {countryTag}
          </PageKicker>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(36px,5.4vw,52px)] leading-[1.12] m-0 text-balance">
            {t("home.title1")}
            <br />
            <span className="grad-text">{t("home.title2")}</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="text-ink-soft text-[17px] leading-[1.75] my-7 max-w-[520px]">
            {t("home.sub")}
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/money#zakai-money-scan">
              <Button className="!text-[15px] !px-6 !py-3">{t("home.cta")}</Button>
            </Link>
            <Link href="#how-zakai-works">
              <Button variant="ghost" className="!text-[14px]">
                {t("home.ctaSecondary")}
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>

      <Reveal delay={100}>
        <Link href="/money#zakai-money-scan" className="no-underline block mb-10">
          <SpotlightCard className="p-7 sm:p-8 border-[rgba(63,203,155,0.5)] bg-[rgba(63,203,155,0.1)] hover:scale-[1.01] transition-transform">
            <div className="flex flex-wrap items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[rgba(63,203,155,0.22)] flex items-center justify-center shrink-0">
                <ScanLine size={24} className="text-emerald" aria-hidden />
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="text-[12px] font-extrabold text-emerald tracking-wide mb-1">
                  {t("home.moneyFeatureTitle")}
                </div>
                <div className="font-extrabold text-[22px] text-emerald leading-tight">
                  {t("door.money.title")}
                </div>
                <p className="text-ink-soft text-[14.5px] mt-2 mb-0 leading-relaxed max-w-[520px]">
                  {t("home.moneyFeatureSub")}
                </p>
                <div className="mt-4 text-[15px] font-extrabold text-emerald">
                  {t("home.moneyFeatureCta")} →
                </div>
              </div>
            </div>
          </SpotlightCard>
        </Link>
      </Reveal>

      <Reveal delay={80}>
        <ul className="flex flex-col gap-2 mb-10 list-none p-0 m-0 max-w-[560px]">
          {trust.map((line) => (
            <li key={line} className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
              <span className="text-emerald font-black" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </Reveal>

      <div id="how-zakai-works">
        <Reveal>
          <h2 className="text-[17px] font-extrabold mb-4">{t("home.howTitle")}</h2>
        </Reveal>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] mb-10">
          {steps.map((key, i) => (
            <Reveal key={key} delay={i * 90}>
              <SpotlightCard className="p-6 h-full">
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                    {i + 1}
                  </div>
                </div>
                <div className="font-extrabold text-base mt-3">
                  {t("onboarding.steps." + key + ".title")}
                </div>
                <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
                  {t("onboarding.steps." + key + ".sub")}
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="mb-12">
            <Link href="/money#zakai-money-scan">
              <Button className="!text-[14px] !px-5 !py-2.5">{t("home.cta")}</Button>
            </Link>
          </div>
        </Reveal>
      </div>

      {/* Quiet signal for DoorTracker experiments — no competing shortcut strip. */}
      <DoorTracker experimentId="home_door_order" armId="money_first" />

      <Reveal delay={40}>
        <div className="mb-10">
          <LiveGravityStrip
            localeBcp47={bcp47[locale as Locale]}
            verifiedMinor={gravity.monthlyAgorot}
            verifiedCount={gravity.count}
            sentCount={gravity.sentCount}
            mandateCount={gravity.mandateCount}
            labels={{
              title: t("home.gravityTitle"),
              sent: t("home.gravitySent"),
              mandates: t("home.gravityMandates"),
              proofs: t("home.gravityProofs"),
              empty: t("home.gravityEmpty"),
              ledger: t("home.gravityLedger"),
            }}
          />
        </div>
      </Reveal>

      <Reveal delay={40}>
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-4 py-5 mb-10">
          {(
            (t.raw("home.stats") as Array<{ n: string; label: string }>) || []
          ).map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display grad-text text-[clamp(20px,4.5vw,28px)] leading-none tabular-nums">
                {s.n}
              </div>
              <div className="text-ink-soft text-[11.5px] mt-1.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] px-6 py-8 text-center mb-10">
          <div className="font-display text-[clamp(22px,4vw,32px)] leading-tight">
            {t("home.closingTitle")}
          </div>
          <p className="text-ink-soft text-[15px] mt-3 max-w-[520px] mx-auto leading-relaxed">
            {t("home.closingSub")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link href="/money#zakai-money-scan">
              <Button className="!text-[15px] !px-6 !py-3">{t("home.closingCta")}</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      <details className="mb-8 text-[13px] text-ink-soft">
        <summary className="cursor-pointer font-bold select-none text-center list-outside">
          {t("home.agentBrainKicker")} · {t("home.institutionsTitle")}
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-5 text-center">
            <div className="font-extrabold text-[15px]">{t("home.agentBrainTitle")}</div>
            <p className="text-ink-soft text-[13.5px] mt-2 mb-4 leading-relaxed max-w-[480px] mx-auto">
              {t("home.agentBrainSub")}
            </p>
            <Link href="/money#zakai-money-scan" className="no-underline">
              <Button variant="ghost" className="!text-[13px]">
                {t("home.agentBrainCta")}
              </Button>
            </Link>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-5 text-center">
            <div className="font-extrabold text-[15px]">{t("home.institutionsTitle")}</div>
            <p className="text-ink-soft text-[13px] mt-2 mb-4 leading-relaxed max-w-[480px] mx-auto">
              {t("home.institutionsSub")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/institutions/quickstart" className="no-underline">
                <Button variant="ghost" className="!text-[13px]">
                  {t("home.institutionsQuickstart")}
                </Button>
              </Link>
              <Link href="/institutions" className="no-underline">
                <Button variant="ghost" className="!text-[13px]">
                  {t("home.institutionsCta")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </details>

      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[560px] mx-auto">
        {t("home.scopeNote")}
      </p>
    </main>
  );
}
