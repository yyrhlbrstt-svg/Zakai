import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { HomeCalculator } from "@/components/HomeCalculator";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const steps = ["upload", "act", "pay"] as const;
  const trust = t.raw("home.trust") as string[];

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      <div className="flex flex-wrap gap-12 items-center">
        <div className="flex-1 min-w-[300px] basis-[400px]">
          <Reveal>
            <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(44,229,167,0.1)] border border-[rgba(44,229,167,0.3)] rounded-full px-3.5 py-1.5 mb-6">
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
            <Link href="/check">
              <Button>{t("home.cta")}</Button>
            </Link>
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
          <HomeCalculator />
        </Reveal>
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

      <p className="mt-10 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[560px] mx-auto">
        {t("home.scopeNote")}
      </p>
    </main>
  );
}
