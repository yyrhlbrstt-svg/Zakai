import type { Metadata } from "next";
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
  const t = await getTranslations({ locale, namespace: "baggage" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function BaggagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("baggage");
  const rights = t.raw("rights") as string[];
  const steps = t.raw("steps") as string[];
  const traps = t.raw("traps") as string[];

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
        <SpotlightCard className="p-6 mt-8">
          <div className="text-[13px] text-ink-soft font-bold">{t("capLabel")}</div>
          <div className="font-display grad-text text-[clamp(30px,7vw,44px)] leading-none mt-2">
            {t("capAmount")}
          </div>
          <div className="text-[13px] text-ink-soft mt-2 leading-relaxed">{t("capNote")}</div>
        </SpotlightCard>
      </Reveal>

      <Reveal>
        <h2 className="font-display text-2xl mt-12 mb-4">{t("rightsTitle")}</h2>
      </Reveal>
      <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
        {rights.map((r) => (
          <li
            key={r}
            className="flex gap-3 items-start rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-3.5"
          >
            <span className="text-emerald font-black mt-0.5" aria-hidden>
              ✓
            </span>
            <span className="text-[14.5px] leading-relaxed">{r}</span>
          </li>
        ))}
      </ul>

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

      {/* The airline's tricks — forewarned is forearmed. */}
      <Reveal>
        <div className="mt-12 rounded-2xl border border-[rgba(240,138,107,0.3)] bg-[rgba(240,138,107,0.06)] p-6">
          <h2 className="text-[16px] font-extrabold text-[#f08a6b] flex items-center gap-2 mb-3">
            <span aria-hidden>⚠︎</span> {t("trapsTitle")}
          </h2>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {traps.map((tr) => (
              <li key={tr} className="flex gap-2.5 items-start text-[14px] text-ink-soft leading-relaxed">
                <span className="text-[#f08a6b] font-black shrink-0" aria-hidden>
                  •
                </span>
                {tr}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
          <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
            <div className="font-display text-xl">{t("cta.title")}</div>
            <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
              {t("cta.body")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-5">
              <Link href="/flights">
                <Button>{t("cta.primary")}</Button>
              </Link>
              <Link href="/faq">
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
