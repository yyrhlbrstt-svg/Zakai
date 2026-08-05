import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { RefundChaseTool } from "@/components/RefundChaseTool";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "priceProtection" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface Where {
  icon: string;
  title: string;
  body: string;
}

export default async function PriceProtectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("priceProtection");
  const wheres = t.raw("wheres") as Where[];
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
        <h2 className="font-display text-2xl mt-11 mb-4">{t("wheresTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {wheres.map((w, i) => (
          <Reveal key={w.title} delay={i * 70}>
            <SpotlightCard className="p-6 h-full">
              <div className="text-[26px]" aria-hidden>
                {w.icon}
              </div>
              <div className="font-extrabold text-[15.5px] mt-3">{w.title}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{w.body}</div>
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

      <Reveal>
        <h2 className="font-display text-2xl mt-12 mb-2">{t("cta.title")}</h2>
        <p className="text-ink-soft text-[14px] mb-5 max-w-[520px] leading-relaxed">{t("cta.body")}</p>
      </Reveal>
      <RefundChaseTool />
      <div className="mt-4">
        <Link href="/faq">
          <Button variant="ghost">{t("cta.secondary")}</Button>
        </Link>
      </div>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
