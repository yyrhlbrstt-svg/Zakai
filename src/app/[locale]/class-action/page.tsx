import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { GradientCtaCard } from "@/components/GradientCtaCard";
import { setRequestLocale, getTranslations } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "classAction" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface Item {
  icon: string;
  title: string;
  body: string;
}

export default async function ClassActionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("classAction");
  const examples = t.raw("examples") as Item[];
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

      <Reveal delay={80}>
        <div className="mt-8 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-6 py-6 text-center">
          <div className="font-display grad-text text-[clamp(26px,6vw,38px)] leading-tight text-balance">
            {t("bigNumber")}
          </div>
          <div className="text-ink-soft text-[13.5px] mt-2.5 max-w-[540px] mx-auto leading-relaxed">
            {t("bigNumberSub")}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <h2 className="font-display text-2xl mt-14 mb-4">{t("examplesTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {examples.map((e, i) => (
          <Reveal key={e.title} delay={i * 80}>
            <SpotlightCard className="p-6 h-full">
              <div className="text-[26px]" aria-hidden>
                {e.icon}
              </div>
              <div className="font-extrabold text-[15.5px] mt-3">{e.title}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{e.body}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="font-display text-2xl mt-14 mb-4">{t("howTitle")}</h2>
      </Reveal>
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {steps.map((s, i) => (
          <Reveal key={s} delay={i * 60} as="li" className="flex gap-3.5 items-start rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
              <span className="w-[26px] h-[26px] shrink-0 rounded-full grad-bg text-[#06121A] flex items-center justify-center font-black text-[13px]">
                {i + 1}
              </span>
              <span className="text-[14.5px] leading-relaxed">{s}</span>
            </Reveal>
        ))}
      </ol>

      <Reveal>
        <GradientCtaCard><div className="font-display text-xl">{t("cta.title")}</div>
            <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
              {t("cta.body")}
            </p>
            {/* In-app only: the primary CTA routes into Zakai's own claim
                flow — the customer never gets sent to a government site. */}
            <div className="flex flex-wrap gap-3 justify-center mt-5">
              <Link href="/money">
                <Button>{t("cta.primary")}</Button>
              </Link>
              <Link href="/entitlements">
                <Button variant="ghost">{t("cta.secondary")}</Button>
              </Link>
            </div>
        </GradientCtaCard>
      </Reveal>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.85)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
