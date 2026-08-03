import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { Zakameter } from "@/components/Zakameter";
import { Reveal } from "@/components/Reveal";
import { PageKicker } from "@/components/PageKicker";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Globe, ScanLine } from "lucide-react";
import { isIsrael, getCountry } from "@/lib/geo";
import { bcp47, type Locale } from "@/i18n/config";
import { currentArm } from "@/lib/evolve/store";
import { ENTITLEMENTS } from "@/lib/rights";
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
 * The homepage's own copy ("home.proof") promises this figure comes "straight
 * from the proof ledger — never typed in." That promise was false: this used
 * to sum every SavingsProof row, verified and self-reported alike, into one
 * number — exactly the "wall that silently mixes documented outcomes with
 * remembered ones" that selfReportedSaving.ts's own docstring warns is a
 * fabricated traction metric wearing a receipt. provenSavings() keeps the two
 * apart; the flagship homepage number now only ever counts the verified side,
 * which is the only side the copy is actually allowed to describe that way.
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
  // Counted from the catalogue so the front page cannot disagree with it.
  const ilRightsCount = ENTITLEMENTS.filter((e) => !/^(us|uk|de|fr|ca|au|it)_/.test(e.id)).length;

  const steps = ["upload", "act", "pay"] as const;
  const trust = (t.raw("home.trust") as string[]) || [];
  const israeliVisitor = await isIsrael();
  const visitorCountry = await getCountry();

  let countryTag = "";
  if (visitorCountry) {
    try {
      const name = new Intl.DisplayNames([locale], { type: "region" }).of(
        visitorCountry
      );
      if (name) countryTag = " · " + name;
    } catch {
      // ignore
    }
  }

  // Secondary-door order still learns from convert experiments — but Money Hub
  // is no longer one of several equal front doors; it is the only start.
  const doorArm = await currentArm<string[]>("home_door_order");
  const doorOrder = doorArm?.payload ?? ["cancel", "owed", "electricity"];

  const secondaryDoorsByKey = [
    { href: "/cancel", titleKey: "door.cancel.title" },
    { href: "/entitlements", titleKey: "door.owed.title" },
    { href: "/electricity", titleKey: "door.electricity.title" },
    { href: "/incident", titleKey: "door.incident.title" },
    { href: "/dormant", titleKey: "door.dormant.title" },
    { href: "/vehicle-check", titleKey: "door.vehicleCheck.title" },
  ];

  const doorKey = (href: string) => {
    const slug = href.replace("/", "");
    if (slug === "what-am-i-owed" || slug === "entitlements") return "owed";
    return slug;
  };
  const rank = (href: string) => {
    const i = doorOrder.indexOf(doorKey(href));
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const secondaryDoors = [...secondaryDoorsByKey].sort(
    (a, b) => rank(a.href) - rank(b.href),
  );

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      {!israeliVisitor && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[rgba(62,198,255,0.28)] bg-[rgba(62,198,255,0.06)] px-5 py-3.5 text-[13.5px] text-ink-soft leading-relaxed">
          <Globe size={18} className="shrink-0 text-[#3ec6ff]" aria-hidden />
          <span>{t("home.geoNote")}</span>
        </div>
      )}

      {/* One composition: brand + one headline + one sub + one CTA group. */}
      <div className="mb-10 max-w-[640px]">
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
          <div className="flex flex-wrap gap-3 mb-2">
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

      <Reveal delay={120}>
        <Link href="/money#zakai-money-scan" className="no-underline block mb-10">
          <SpotlightCard className="p-7 sm:p-8 border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.08)] hover:scale-[1.01] transition-transform">
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
        <div className="mb-12">
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

      <Reveal delay={100}>
        <ul className="flex flex-col gap-2 mb-10 list-none p-0 m-0 max-w-[560px]">
          {trust.map((line) => (
            <li
              key={line}
              className="flex items-center gap-2.5 text-[13.5px] text-ink-soft"
            >
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
          <h2 className="text-[17px] font-extrabold mb-4">
            {t("home.howTitle")}
          </h2>
        </Reveal>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] mb-14">
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
      </div>

      <Reveal delay={60}>
        <h2 className="text-[17px] font-extrabold mb-3">{t("home.systemsTitle")}</h2>
        <ul className="flex flex-col gap-2 list-none p-0 m-0 max-w-[560px] mb-14">
          {((t.raw("home.systemsBullets") as string[]) || []).map((line) => (
            <li
              key={line}
              className="flex items-start gap-2.5 text-[13.5px] text-ink-soft leading-relaxed"
            >
              <span className="text-emerald font-black shrink-0" aria-hidden>
                →
              </span>
              {line}
            </li>
          ))}
        </ul>
      </Reveal>

      {/* Shortcuts sit below the loop explanation so they cannot compete with Money Hub. */}
      <DoorTracker experimentId="home_door_order" armId={doorArm?.id ?? "money_first"} />
      <Reveal>
        <h2 className="text-[15px] font-extrabold mb-1 text-ink-soft">
          {t("home.secondaryDoors")}
        </h2>
        <p className="text-[13px] text-ink-soft mb-4 max-w-[560px] leading-relaxed">
          {t("home.secondaryDoorsSub")}
        </p>
      </Reveal>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-14 max-w-[720px]">
        {secondaryDoors.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="text-[13.5px] font-bold text-ink-soft no-underline hover:text-emerald transition-colors"
          >
            {t(d.titleKey)} →
          </Link>
        ))}
      </div>

      <Reveal delay={60}>
        <h2 className="text-[15px] font-extrabold mb-4 text-ink-soft">
          {t("home.estimateTitle")}
        </h2>
        <div className="mb-10 max-w-[480px]">
          <Zakameter bcp47={bcp47[locale as Locale]} />
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-4 py-5 mb-4">
          {(
            (t.raw("home.stats") as Array<{ n: string; label: string }>) || []
          ).map((s, i) => (
            <div key={s.label} className="text-center">
              <div className="font-display grad-text text-[clamp(24px,6vw,34px)] leading-none tabular-nums">
                {i === 1 ? ilRightsCount : s.n}
              </div>
              <div className="text-ink-soft text-[11.5px] mt-1.5 leading-tight">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">
          {t("home.whyTitle")}
        </h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {(["alone", "services", "zakai"] as const).map((col, i) => {
          const isZakai = col === "zakai";
          const cardCls = isZakai
            ? "p-6 h-full border-[rgba(63,203,155,0.45)]"
            : "p-6 h-full";
          const titleCls = isZakai
            ? "font-extrabold text-[15px] text-emerald"
            : "font-extrabold text-[15px]";
          const points =
            (t.raw("home.why." + col + ".points") as string[]) || [];
          return (
            <Reveal key={col} delay={i * 90}>
              <SpotlightCard className={cardCls}>
                <div className={titleCls}>
                  {t("home.why." + col + ".title")}
                </div>
                <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                  {points.map((p) => (
                    <li
                      key={p}
                      className="flex gap-2.5 items-start text-[13px] text-ink-soft leading-relaxed"
                    >
                      <span
                        className={
                          isZakai
                            ? "font-black shrink-0 text-emerald"
                            : "font-black shrink-0 text-[rgba(147,166,165,0.6)]"
                        }
                        aria-hidden
                      >
                        {isZakai ? "✓" : "•"}
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>

      <Reveal>
        <div className="mt-16 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-6 py-7">
          <h2 className="font-display text-[clamp(20px,3.5vw,26px)] m-0 text-center">
            {t("home.developersTitle")}
          </h2>
          <p className="text-ink-soft text-[14.5px] mt-3 max-w-[560px] mx-auto text-center leading-relaxed">
            {t("home.developersSub")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-5">
            <Link href="/tools">
              <Button variant="ghost" className="!text-[13.5px]">
                {t("home.developersTools")}
              </Button>
            </Link>
            <Link href="/network-proof">
              <Button variant="ghost" className="!text-[13.5px]">
                {t("home.developersProof")}
              </Button>
            </Link>
            <Link href="/integrations">
              <Button variant="ghost" className="!text-[13.5px]">
                {t("home.developersIntegrations")}
              </Button>
            </Link>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-16 rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] px-6 py-8 text-center">
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
            <Link href="/institutions">
              <Button variant="ghost">{t("home.closingB2b")}</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      <p className="mt-10 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[560px] mx-auto">
        {t("home.scopeNote")}
      </p>
    </main>
  );
}
