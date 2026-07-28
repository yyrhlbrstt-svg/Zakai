import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LeadCta } from "@/components/LeadCta";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { BankFeesTool } from "@/components/BankFeesTool";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bankFees" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface FeeItem {
  name: string;
  note: string;
}

export default async function BankFeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bankFees");
  const fees = t.raw("fees") as FeeItem[];
  const steps = t.raw("steps") as string[];
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_bank_fees_page = await getTranslations({ locale, namespace: "inline_app_locale_bank_fees_page" });

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

      <Reveal>
        <h2 className="font-display text-2xl mt-10 mb-3">
          {tIapp_locale_bank_fees_page("t_17d5ad42")}
        </h2>
        <p className="text-ink-soft text-[14px] mb-4 leading-relaxed">
          {tIapp_locale_bank_fees_page("t_ab015246")}
        </p>
      </Reveal>
      <BankFeesTool />

      <Reveal>
        <h2 className="font-display text-2xl mt-11 mb-4">{t("feesTitle")}</h2>
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {fees.map((f, i) => (
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

      <Reveal>
        <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
          <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
            <div className="font-display text-xl">{t("cta.title")}</div>
            <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
              {t("cta.body")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-5">
              <Link href="/money">
                <Button>{tIapp_locale_bank_fees_page("t_bd4c0905")}</Button>
              </Link>
              <Link href="/scan">
                <Button variant="ghost">{t("cta.primary")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
      <LeadCta vertical="bank-fees" />

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </main>
  );
}
