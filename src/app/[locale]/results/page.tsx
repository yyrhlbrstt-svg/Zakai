import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { computeImpact } from "@/lib/impact";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

/** Refresh the live numbers hourly (ISR). Honest data, fast page. */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "results" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("results");
  const loc = bcp47[locale as Locale];
  const impact = computeImpact ? await computeImpact() : null;
  const stats = impact ?? {
    documentedMonthlyAgorot: 0,
    documentedCount: 0,
    checksRun: 0,
    potentialMonthlyAgorot: 0,
  };

  // Day-one honesty: before real savings exist, lead with the mechanism of
  // trust, not a vanity number. The counters still show (truthfully zero).
  const started = stats.documentedCount > 0;

  const proofSteps = t.raw("proof.steps") as Array<{ title: string; body: string }>;

  return (
    <main className="max-w-[820px] mx-auto px-5 pb-24 pt-5">
      <Reveal>
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
          {t("kicker")}
        </div>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.12] m-0 text-balance">
          {t("title")}
        </h1>
        <p className="text-ink-soft text-[16px] leading-relaxed mt-4 max-w-[620px]">
          {started ? t("subStarted") : t("subEmpty")}
        </p>
      </Reveal>

      {/* Live counters — always truthful, straight from the ledger. */}
      <Reveal delay={80}>
        <div className="mt-8 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {[
            {
              n: formatAgorot(stats.documentedMonthlyAgorot, loc),
              label: t("stats.documented"),
              hero: true,
            },
            { n: stats.documentedCount.toLocaleString(loc), label: t("stats.count") },
            { n: stats.checksRun.toLocaleString(loc), label: t("stats.checks") },
            {
              n: formatAgorot(stats.potentialMonthlyAgorot, loc),
              label: t("stats.potential"),
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border px-4 py-5 text-center ${
                s.hero
                  ? "border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)]"
                  : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="font-display grad-text text-[clamp(22px,5vw,30px)] leading-none tabular-nums">
                {s.n}
              </div>
              <div className="text-ink-soft text-[12px] mt-2 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] text-[rgba(147,166,165,0.7)] mt-3 text-center">
          {t("stats.note")}
        </p>
      </Reveal>

      {/* How every shekel is proven — the real trust engine. */}
      <Reveal>
        <h2 className="font-display text-2xl mt-14 mb-1.5">{t("proof.title")}</h2>
        <p className="text-ink-soft text-[14.5px] mb-5 max-w-[600px]">{t("proof.intro")}</p>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {proofSteps.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <SpotlightCard className="p-6 h-full">
              <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                {i + 1}
              </div>
              <div className="font-extrabold text-[15.5px] mt-3">{s.title}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{s.body}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      {/* Be among the first — honest CTA for the launch phase. */}
      <Reveal>
        <div className="mt-14 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
          <div className="rounded-2xl bg-[#0a1119] px-6 py-8 text-center">
            <div className="font-display text-2xl">{t("cta.title")}</div>
            <p className="text-ink-soft text-[14.5px] mt-2 max-w-[520px] mx-auto leading-relaxed">
              {t("cta.body")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-6">
              <Link href="/check">
                <Button>{t("cta.primary")}</Button>
              </Link>
              <Link href="/entitlements">
                <Button variant="ghost">{t("cta.secondary")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </main>
  );
}
