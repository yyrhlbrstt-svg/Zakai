import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { GradientCtaCard } from "@/components/GradientCtaCard";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LeadCta } from "@/components/LeadCta";
import { ArnonaAgent } from "@/components/ArnonaAgent";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "arnona" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface ErrItem {
  name: string;
  note: string;
}

export default async function ArnonaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("arnona");
  const errors = t.raw("errors") as ErrItem[];
  const steps = t.raw("steps") as string[];

  return (
    <VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[820px] mx-auto px-5 pb-24 pt-5 relative"
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
    >

      <Reveal>
        <h2 className="font-display text-2xl mt-11 mb-4">{t("errorsTitle")}</h2>
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {errors.map((f, i) => (
          <Reveal key={f.name} delay={i * 60}>
            <SpotlightCard className="p-5 h-full">
              <div className="font-extrabold text-[15px]">{f.name}</div>
              <div className="text-ink-soft text-[13px] mt-1.5 leading-relaxed">{f.note}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="font-display text-2xl mt-12 mb-4">{t("stepsTitle")}</h2>
      </Reveal>
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {steps.map((s, i) => (
          <li
            key={s}
            className="flex gap-3.5 items-start rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4"
          >
            <span className="w-[26px] h-[26px] shrink-0 rounded-full grad-bg text-[#06121A] flex items-center justify-center font-black text-[13px]">
              {i + 1}
            </span>
            <span className="text-[14.5px] leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>

      {/* Copy-paste self-help objection — the resident sends it themselves. */}
      <Reveal>
        <h2 className="font-display text-2xl mt-12 mb-3">{t("templateTitle")}</h2>
        <p className="text-ink-soft text-[14px] mb-4">{t("templateSub")}</p>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-5">
          <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink m-0">
            {t("template")}
          </pre>
        </div>
      </Reveal>

      <Reveal>
        <ArnonaAgent />
      </Reveal>

      <Reveal>
        <GradientCtaCard><div className="font-display text-xl">{t("cta.title")}</div>
            <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
              {t("cta.body")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-5">
              <Link href="/entitlements">
                <Button>{t("cta.primary")}</Button>
              </Link>
              <Link href="/rights">
                <Button variant="ghost">{t("cta.secondary")}</Button>
              </Link>
            </div>
        </GradientCtaCard>
      </Reveal>
      <LeadCta vertical="arnona" />


      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
