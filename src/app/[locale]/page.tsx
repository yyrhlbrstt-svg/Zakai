import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { Zakameter } from "@/components/Zakameter";
import { Reveal } from "@/components/Reveal";
import { PageKicker } from "@/components/PageKicker";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Globe, ScanLine, Ban, Scale, Zap, HeartPulse, Archive, Car } from "lucide-react";
import { formatAgorot } from "@/lib/money";
import { isIsrael, getCountry } from "@/lib/geo";
import { bcp47, type Locale } from "@/i18n/config";
import { currentArm } from "@/lib/evolve/store";
import { ENTITLEMENTS } from "@/lib/rights";
import { DoorTracker } from "@/components/DoorTracker";
import { provenSavings } from "@/lib/services/selfReportedSaving";

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
 * Without this, a search engine sees four unrelated pages at the same content
 * — one per locale — rather than four language variants of one page.
 * The flagship homepage number only ever counts verified SavingsProofs.
 */
async function loadProof() {
  const proof = await provenSavings();
  return { monthlyAgorot: proof.verifiedMinor, count: proof.verifiedCount };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const proof = await loadProof();
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

  const doorArm = await currentArm<string[]>("home_door_order");
  const doorOrder = doorArm?.payload ?? ["money", "cancel", "owed", "electricity"];

  const doorsByKey = [
    {
      href: "/money",
      icon: ScanLine,
      titleKey: "door.money.title",
      subKey: "door.money.sub",
      ctaKey: "door.money.cta",
      accent: "emerald",
    },
    {
      href: "/cancel",
      icon: Ban,
      titleKey: "door.cancel.title",
      subKey: "door.cancel.sub",
      ctaKey: "door.cancel.cta",
      accent: "violet",
    },
    {
      href: "/entitlements",
      icon: Scale,
      titleKey: "door.owed.title",
      subKey: "door.owed.sub",
      ctaKey: "door.owed.cta",
      accent: "sky",
    },
    {
      href: "/electricity",
      icon: Zap,
      titleKey: "door.electricity.title",
      subKey: "door.electricity.sub",
      ctaKey: "door.electricity.cta",
      accent: "amber",
    },
    {
      href: "/incident",
      icon: HeartPulse,
      titleKey: "door.incident.title",
      subKey: "door.incident.sub",
      ctaKey: "door.incident.cta",
      accent: "violet",
    },
    {
      href: "/dormant",
      icon: Archive,
      titleKey: "door.dormant.title",
      subKey: "door.dormant.sub",
      ctaKey: "door.dormant.cta",
      accent: "sky",
    },
    {
      href: "/vehicle-check",
      icon: Car,
      titleKey: "door.vehicleCheck.title",
      subKey: "door.vehicleCheck.sub",
      ctaKey: "door.vehicleCheck.cta",
      accent: "amber",
    },
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
  const doors = [...doorsByKey].sort((a, b) => rank(a.href) - rank(b.href));

  const accentBorder: Record<string, string> = {
    emerald: "border-[rgba(63,203,155,0.45)]",
    violet: "border-[rgba(139,92,246,0.4)]",
    sky: "border-[rgba(62,198,255,0.4)]",
    amber: "border-[rgba(240,180,92,0.4)]",
  };
  const accentBg: Record<string, string> = {
    emerald: "bg-[rgba(63,203,155,0.1)]",
    violet: "bg-[rgba(139,92,246,0.08)]",
    sky: "bg-[rgba(62,198,255,0.08)]",
    amber: "bg-[rgba(240,180,92,0.08)]",
  };
  const accentText: Record<string, string> = {
    emerald: "text-emerald",
    violet: "text-[#c4b5fd]",
    sky: "text-[#3ec6ff]",
    amber: "text-[#f0b45c]",
  };
  const accentIconBg: Record<string, string> = {
    emerald: "bg-[rgba(63,203,155,0.22)]",
    violet: "bg-[rgba(139,92,246,0.2)]",
    sky: "bg-[rgba(62,198,255,0.2)]",
    amber: "bg-[rgba(240,180,92,0.2)]",
  };

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      {!israeliVisitor && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[rgba(62,198,255,0.28)] bg-[rgba(62,198,255,0.06)] px-5 py-3.5 text-[13.5px] text-ink-soft leading-relaxed">
          <Globe size={18} className="shrink-0 text-[#3ec6ff]" aria-hidden />
          <span>{t("home.geoNote")}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-12 items-center mb-12">
        <div className="flex-1 min-w-[300px] basis-[400px]">
          <Reveal>
            <PageKicker className="mb-6">
              {t("home.kicker")}
              {countryTag}
            </PageKicker>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(36px,5.4vw,54px)] leading-[1.1] m-0 text-balance tracking-[-0.02em]">
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
                <Button className="!text-[15px] !px-7 !py-3.5">{t("home.cta")}</Button>
              </Link>
              <Link href="/leaks">
                <Button variant="ghost" className="!text-[14px]">
                  {t("home.heroLeaks")}
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={160} className="flex-1 min-w-[320px] basis-[380px]">
          <Zakameter bcp47={bcp47[locale as Locale]} />
        </Reveal>
      </div>

      <Reveal>
        <h2 className="text-[15px] font-extrabold mb-4 text-ink-soft">
          {t("door.title")}
        </h2>
      </Reveal>

      <DoorTracker experimentId="home_door_order" armId={doorArm?.id ?? "money_first"} />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] mb-14">
        {doors.map((d, i) => {
          const Icon = d.icon;
          const featured = i === 0;
          const cardClass =
            "p-6 h-full " +
            accentBorder[d.accent] +
            " " +
            accentBg[d.accent] +
            " hover:scale-[1.02] transition-transform" +
            (featured ? " sm:col-span-2 md:col-span-2 shadow-[0_20px_50px_rgba(63,203,155,0.12)]" : "");
          const iconClass =
            "w-11 h-11 rounded-xl " +
            accentIconBg[d.accent] +
            " flex items-center justify-center mb-4";
          return (
            <Reveal key={d.href} delay={i * 70} className={featured ? "sm:col-span-2 md:col-span-2" : undefined}>
              <Link href={d.href} className="no-underline block h-full">
                <SpotlightCard className={cardClass}>
                  <div className={featured ? "sm:flex sm:items-start sm:gap-5" : undefined}>
                    <div className={iconClass}>
                      <Icon
                        size={22}
                        className={accentText[d.accent]}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={
                          "font-extrabold " +
                          (featured ? "text-[19px] " : "text-[17px] ") +
                          accentText[d.accent]
                        }
                      >
                        {t(d.titleKey)}
                      </div>
                      <div className="text-ink-soft text-[13.5px] mt-2 leading-relaxed max-w-[520px]">
                        {t(d.subKey)}
                      </div>
                      <div
                        className={
                          "mt-4 text-[14px] font-extrabold " + accentText[d.accent]
                        }
                      >
                        {t(d.ctaKey)}
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={80}>
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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

      {proof.count > 0 && (
        <Reveal>
          <div className="mt-10 text-center rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] px-6 py-5 shadow-[0_16px_40px_rgba(63,203,155,0.08)]">
            <span className="font-display grad-text text-3xl">
              {formatAgorot(
                proof.monthlyAgorot,
                bcp47[locale as Locale]
              )}
            </span>
            <span className="block text-[13px] text-ink-soft mt-1.5">
              {t("home.proof", { count: proof.count })}
            </span>
          </div>
        </Reveal>
      )}

      <Reveal delay={100}>
        <ul className="flex flex-col gap-2 mt-10 list-none p-0 m-0 max-w-[560px]">
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

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">
          {t("home.howTitle")}
        </h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {steps.map((key, i) => (
          <Reveal key={key} delay={i * 90}>
            <SpotlightCard className="p-6 h-full">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm shadow-[0_6px_16px_rgba(63,203,155,0.25)]">
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
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">
          {t("home.whyTitle")}
        </h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {(["alone", "services", "zakai"] as const).map((col, i) => {
          const isZakai = col === "zakai";
          const cardCls = isZakai
            ? "p-6 h-full border-[rgba(63,203,155,0.5)] bg-[rgba(63,203,155,0.06)]"
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
        <div className="mt-16 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
        <div className="mt-16 rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)] px-6 py-8 text-center shadow-[0_20px_50px_rgba(63,203,155,0.1)]">
          <div className="font-display text-[clamp(22px,4vw,32px)] leading-tight">
            {t("home.closingTitle")}
          </div>
          <p className="text-ink-soft text-[15px] mt-3 max-w-[520px] mx-auto leading-relaxed">
            {t("home.closingSub")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link href="/money#zakai-money-scan">
              <Button className="!text-[15px] !px-7 !py-3.5">{t("home.closingCta")}</Button>
            </Link>
            <Link href="/business">
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
