import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";

export const metadata: Metadata = {
  title: "זכאי לעובדים — הטבת רווחה שמחזירה כסף | Zakai for Employees",
  description:
    "הטבת רווחה שמחזירה לעובדים כסף אמיתי: בדיקת זכויות, תלוש, חשבונות ומיסים. ללא עלות הקמה — פשוט עובדים מרוצים שמגלים כמה מגיע להם.",
};

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("business");

  const values = t.raw("values") as Array<{ icon: string; title: string; sub: string }>;
  const steps = t.raw("steps") as Array<{ title: string; sub: string }>;

  return (
    <main className="max-w-[980px] mx-auto px-5 pb-24 pt-6">
      <div className="max-w-[640px]">
        <Reveal>
          <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
            {t("kicker")}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(30px,5.4vw,48px)] leading-[1.12] m-0 text-balance">
            {t("title")}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="text-ink-soft text-[16.5px] leading-[1.7] my-6">{t("sub")}</p>
        </Reveal>
        <Reveal delay={240}>
          <a href="#lead" className="inline-block">
            <span className="grad-bg btn-sheen text-[#06121A] font-extrabold rounded-[14px] px-7 py-4 text-[16.5px] inline-block shadow-[0_10px_30px_rgba(63,203,155,0.28)]">
              {t("cta")}
            </span>
          </a>
        </Reveal>
      </div>

      {/* Value props for the employer. */}
      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("valuesTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {values.map((v, i) => (
          <Reveal key={v.title} delay={i * 70}>
            <SpotlightCard className="p-5 h-full">
              <div className="text-[26px]" aria-hidden>{v.icon}</div>
              <div className="font-extrabold text-[15px] mt-2.5">{v.title}</div>
              <div className="text-ink-soft text-[12.5px] mt-1 leading-relaxed">{v.sub}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      {/* How it works. */}
      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("howTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <SpotlightCard className="p-6 h-full">
              <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                {i + 1}
              </div>
              <div className="font-extrabold text-base mt-3">{s.title}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{s.sub}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      {/* Lead form. */}
      <div id="lead" className="mt-16 scroll-mt-6">
        <Reveal>
          <div className="max-w-[620px] mx-auto rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.025)] p-6 sm:p-8">
            <h2 className="font-display text-2xl mb-1.5">{t("form.title")}</h2>
            <p className="text-ink-soft text-[13.5px] mb-6">{t("form.sub")}</p>
            <BusinessLeadForm />
          </div>
        </Reveal>
      </div>
    </main>
  );
}
