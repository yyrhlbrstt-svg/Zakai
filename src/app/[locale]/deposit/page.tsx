import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { DepositReturnClaim } from "@/components/DepositReturnClaim";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { SectionHeading } from "@/components/SectionHeading";
import { NumberedStepList } from "@/components/NumberedStepList";
import { GradientCtaCard } from "@/components/GradientCtaCard";
import { bcp47, type Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deposit" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface RuleItem {
  name: string;
  note: string;
}

export default async function DepositPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("deposit");
  const rules = t.raw("rules") as RuleItem[];
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
        <SectionHeading title={t("rulesTitle")} className="mt-4 mb-4" />
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {rules.map((r, i) => (
          <Reveal key={r.name} delay={i * 60}>
            <SpotlightCard className="p-5 h-full">
              <div className="font-extrabold text-[15px]">{r.name}</div>
              <div className="text-ink-soft text-[13px] mt-1.5 leading-relaxed">{r.note}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <SectionHeading title={t("stepsTitle")} className="mt-12 mb-4" />
      </Reveal>
      <NumberedStepList steps={steps} />

      <Reveal>
        <SectionHeading title={t("templateTitle")} description={t("templateSub")} className="mt-12 mb-3" />
        <DepositReturnClaim bcp47={bcp47[locale as Locale]} />
      </Reveal>

      <Reveal>
        <GradientCtaCard>
          <div className="font-display text-xl">{t("cta.title")}</div>
          <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
            {t("cta.body")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-5">
            <Link href="/what-am-i-owed">
              <Button>{t("cta.primary")}</Button>
            </Link>
            <Link href="/rights">
              <Button variant="ghost">{t("cta.secondary")}</Button>
            </Link>
          </div>
        </GradientCtaCard>
      </Reveal>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
