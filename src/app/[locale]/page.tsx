import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui";
import { Zakameter } from "@/components/Zakameter";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

/** Refresh the live proof numbers hourly (ISR) — fast page, honest data. */
export const revalidate = 3600;

/**
 * Live social proof from the append-only savings ledger. Returns zeros (and
 * the section hides) until real documented savings exist — an honest counter
 * or none at all. Build-safe: a missing DB just hides the section.
 */
async function loadProof() {
  try {
    const [agg, count] = await Promise.all([
      prisma.savingsProof.aggregate({ _sum: { savingMonthly: true } }),
      prisma.savingsProof.count({ where: { savingMonthly: { gt: 0 } } }),
    ]);
    return { monthlyAgorot: agg._sum.savingMonthly ?? 0, count };
  } catch {
    return { monthlyAgorot: 0, count: 0 };
  }
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

  const steps = ["upload", "act", "pay"] as const;
  const trust = t.raw("home.trust") as string[];

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      <div className="flex flex-wrap gap-12 items-center">
        <div className="flex-1 min-w-[300px] basis-[400px]">
          <Reveal>
            <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-6">
              {t("home.kicker")}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(38px,5.6vw,56px)] leading-[1.12] m-0 text-balance">
              {t("home.title1")}
              <br />
              <span className="grad-text">{t("home.title2")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-ink-soft text-[17px] leading-[1.75] my-7 max-w-[480px]">
              {t("home.sub")}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap gap-3 items-center">
              <Link href="/check">
                <Button>{t("home.cta")}</Button>
              </Link>
              <Link href="/entitlements">
                <Button variant="ghost">{t("nav.entitlements")}</Button>
              </Link>
            </div>
          </Reveal>

          {/* Trust signals, above the fold, as first-class content. */}
          <Reveal delay={320}>
            <ul className="flex flex-col gap-2 mt-7 list-none p-0 m-0">
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
        </div>

        <Reveal delay={160} className="flex-1 min-w-[320px] basis-[380px]">
          <Zakameter bcp47={bcp47[locale as Locale]} />
        </Reveal>
      </div>

      {/* Live social proof — appears only once real documented savings exist.
          Numbers come from the append-only proof ledger, never typed in. */}
      {proof.count > 0 && (
        <Reveal>
          <div className="mt-14 text-center rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-6 py-5">
            <span className="font-display grad-text text-3xl">
              {formatAgorot(proof.monthlyAgorot, bcp47[locale as Locale])}
            </span>
            <span className="block text-[13px] text-ink-soft mt-1.5">
              {t("home.proof", { count: proof.count })}
            </span>
          </div>
        </Reveal>
      )}

      {/* The breadth answer: everything Zakai checks for you, one tap each. */}
      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.verticalsTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {(
          [
            { key: "rights", href: "/rights", icon: "🎯" },
            { key: "payslip", href: "/payslip", icon: "🧾" },
            { key: "severance", href: "/severance", icon: "📄" },
            { key: "miluim", href: "/miluim", icon: "🎖️" },
            { key: "mobile", href: "/check", icon: "📱" },
            { key: "electricity", href: "/electricity", icon: "⚡" },
            { key: "flights", href: "/flights", icon: "✈️" },
            { key: "subs", href: "/scan", icon: "🔁" },
          ] as const
        ).map((v, i) => (
          <Reveal key={v.key} delay={i * 80}>
            <Link href={v.href} className="no-underline text-ink block h-full">
              <SpotlightCard className="p-5 h-full transition-colors duration-200 hover:border-[rgba(63,203,155,0.4)]">
                <div className="text-[26px]" aria-hidden>
                  {v.icon}
                </div>
                <div className="font-extrabold text-[15px] mt-2.5">
                  {t(`home.verticals.${v.key}.title`)}
                </div>
                <div className="text-ink-soft text-[12.5px] mt-1 leading-relaxed">
                  {t(`home.verticals.${v.key}.sub`)}
                </div>
              </SpotlightCard>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* The public pipeline — momentum on display, expectations honest. */}
      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-1.5">{t("home.soonTitle")}</h2>
        <p className="text-ink-soft text-[13px] mt-0 mb-4">{t("home.soonSub")}</p>
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {(
          [
            { key: "taxrefund", icon: "💸" },
            { key: "maternity", icon: "👶" },
            { key: "unemployment", icon: "🧭" },
            { key: "parking", icon: "🅿️" },
            { key: "arnona_refund", icon: "🏠" },
            { key: "deposit", icon: "🔑" },
          ] as const
        ).map((v, i) => (
          <Reveal key={v.key} delay={i * 50}>
            <div className="h-full rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[22px]" aria-hidden>
                  {v.icon}
                </span>
                <span className="text-[10.5px] font-extrabold text-ink-soft border border-[rgba(255,255,255,0.14)] rounded-full px-2 py-0.5">
                  {t("home.soonBadge")}
                </span>
              </div>
              <div className="font-extrabold text-[14px] mt-2">{t(`home.soon.${v.key}.title`)}</div>
              <div className="text-ink-soft text-[12px] mt-1 leading-relaxed">
                {t(`home.soon.${v.key}.sub`)}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.howTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {steps.map((key, i) => (
          <Reveal key={key} delay={i * 90}>
            <SpotlightCard className="p-6 h-full">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                  {i + 1}
                </div>
              </div>
              <div className="font-extrabold text-base mt-3">
                {t(`onboarding.steps.${key}.title`)}
              </div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
                {t(`onboarding.steps.${key}.sub`)}
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      {/* Honest positioning vs the alternatives — no competitor names, just
          the structural differences a reader can verify. */}
      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.whyTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {(["alone", "services", "zakai"] as const).map((col, i) => (
          <Reveal key={col} delay={i * 90}>
            <SpotlightCard
              className={`p-6 h-full ${col === "zakai" ? "border-[rgba(63,203,155,0.45)]" : ""}`}
            >
              <div className={`font-extrabold text-[15px] ${col === "zakai" ? "text-emerald" : ""}`}>
                {t(`home.why.${col}.title`)}
              </div>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {(t.raw(`home.why.${col}.points`) as string[]).map((p) => (
                  <li key={p} className="flex gap-2.5 items-start text-[13px] text-ink-soft leading-relaxed">
                    <span
                      className={`font-black shrink-0 ${col === "zakai" ? "text-emerald" : "text-[rgba(147,166,165,0.6)]"}`}
                      aria-hidden
                    >
                      {col === "zakai" ? "✓" : "•"}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <p className="mt-10 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[560px] mx-auto">
        {t("home.scopeNote")}
      </p>
    </main>
  );
}
