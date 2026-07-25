import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { LeadForm } from "@/components/LeadForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "debtConsolidation" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface Item {
  icon: string;
  title: string;
  body: string;
}

/**
 * Debt consolidation — a high-value, honest lead-gen vertical. Several
 * high-interest debts (overdraft, cards, personal/car loans) merged into one
 * lower-rate loan. Zakai captures the lead and connects to a LICENSED provider
 * for a referral fee; we are not a lender or credit advisor (see disclaimer).
 */
export default async function DebtConsolidationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("debtConsolidation");
  const types = t.raw("types") as Item[];
  const steps = t.raw("steps") as string[];

  return (
    <main className="max-w-[820px] mx-auto px-5 pb-24 pt-5">
      <Reveal>
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
          {t("kicker")}
        </div>
        <h1 className="font-display text-[clamp(28px,5vw,44px)] leading-[1.12] m-0 text-balance">
          {t("title")}
        </h1>
        <p className="text-ink-soft text-[16px] leading-relaxed mt-4 max-w-[640px]">{t("sub")}</p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-8 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-6 py-6 text-center">
          <div className="font-display grad-text text-[clamp(30px,7vw,44px)] leading-none tabular-nums">
            {t("bigNumber")} ₪
          </div>
          <div className="text-ink-soft text-[13.5px] mt-2.5 max-w-[540px] mx-auto leading-relaxed">
            {t("bigNumberSub")}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <h2 className="font-display text-2xl mt-14 mb-4">{t("typesTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {types.map((d, i) => (
          <Reveal key={d.title} delay={i * 70}>
            <SpotlightCard className="p-6 h-full">
              <div className="text-[26px]" aria-hidden>
                {d.icon}
              </div>
              <div className="font-extrabold text-[15.5px] mt-3">{d.title}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{d.body}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="font-display text-2xl mt-14 mb-4">{t("howTitle")}</h2>
      </Reveal>
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {steps.map((s, i) => (
          <Reveal key={s} delay={i * 60}>
            <li className="flex gap-3.5 items-start rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
              <span className="w-[26px] h-[26px] shrink-0 rounded-full grad-bg text-[#06121A] flex items-center justify-center font-black text-[13px]">
                {i + 1}
              </span>
              <span className="text-[14.5px] leading-relaxed">{s}</span>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal>
        <div className="mt-12">
          <LeadForm vertical="debt-consolidation" />
        </div>
      </Reveal>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </main>
  );
}
