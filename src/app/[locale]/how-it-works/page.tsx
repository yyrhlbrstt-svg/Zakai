import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/how-it-works") },
  };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");
  const steps = t.raw("steps") as Array<{ title: string; body: string }>;
  const glossary = t.raw("glossary") as Array<{ term: string; def: string }>;

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      <Reveal>
        <SpotlightCard className="p-6">
          <div className="font-extrabold text-[16px] text-emerald">{t("whatTitle")}</div>
          <p className="text-ink-soft text-[14.5px] mt-2.5 leading-relaxed m-0">{t("whatBody")}</p>
        </SpotlightCard>
      </Reveal>

      <Reveal>
        <h2 className="text-[15px] font-extrabold mt-10 mb-4">{t("stepsTitle")}</h2>
      </Reveal>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 60}>
            <SpotlightCard className="p-5">
              <div className="font-extrabold text-[15px]">{s.title}</div>
              <p className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed m-0">{s.body}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="text-[15px] font-extrabold mt-10 mb-4">{t("glossaryTitle")}</h2>
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {glossary.map((g, i) => (
          <Reveal key={g.term} delay={i * 60}>
            <SpotlightCard className="p-5 h-full">
              <div className="font-extrabold text-[14px] text-emerald" dir="ltr">
                {g.term}
              </div>
              <p className="text-ink-soft text-[13px] mt-1.5 leading-relaxed m-0">{g.def}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-10 rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.025)] p-6">
          <div className="font-extrabold text-[15px]">{t("safeTitle")}</div>
          <p className="text-ink-soft text-[13.5px] mt-2 leading-relaxed m-0">{t("safeBody")}</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-10 text-center rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)] px-6 py-7">
          <div className="font-display text-xl">{t("ctaTitle")}</div>
          <div className="flex flex-wrap gap-3 justify-center mt-5">
            <Link href="/money#zakai-money-scan" className="no-underline">
              <Button className="!text-[15px] !px-7 !py-3.5">{t("ctaBtn")}</Button>
            </Link>
          </div>
          <Link
            href="/faq"
            className="inline-block mt-4 text-[13px] font-bold text-emerald no-underline hover:underline"
          >
            {t("faqLink")}
          </Link>
        </div>
      </Reveal>
    </VerticalPageShell>
  );
}
