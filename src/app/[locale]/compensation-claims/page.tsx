import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { LeadForm } from "@/components/LeadForm";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compensationClaims" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface Item {
  icon: string;
  title: string;
  body: string;
}

/** Self-serve first. Optional licensed partner — never "leave phone and wait". */
export default async function CompensationClaimsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("compensationClaims");
  const types = t.raw("types") as Item[];
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_compensation_claims_page = await getTranslations({ locale, namespace: "inline_app_locale_compensation_claims_page" });

  const steps = he
    ? [
        "פותחים בדיקה בזכאי — בלי להשאיר טלפון ובלי לחכות לנציג שיחזור.",
        "ממפים את הכיסויים (אכ\"ע, נכות, מחלות קשות, סיעוד). רואים מה שווה לבדוק במסך.",
        "אם זה רלוונטי — ממשיכים לעורך דין מומחה רק אחרי שאתה בוחר. עמלה רק על הצלחה מתועדת, אף פעם לא מראש.",
      ]
    : [
        "Start in Zakai — no phone number required, no waiting for a callback.",
        "Map your cover (loss of capacity, disability, critical illness, care) and see what is worth checking on screen.",
        "If relevant — continue to a specialist lawyer only after you choose. Fee only on documented success, never upfront.",
      ];

  return (
    <VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[820px] mx-auto px-5 pb-24 pt-5 relative"
      kicker={tIapp_locale_compensation_claims_page("t_e7b22b9d")}
      title={t("title")}
      sub={tIapp_locale_compensation_claims_page("t_70753b42")}
    >

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
        <h2 className="font-display text-2xl mt-14 mb-4">{tIapp_locale_compensation_claims_page("t_d7059f90")}</h2>
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
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/assistant">
            <Button>{tIapp_locale_compensation_claims_page("t_8abbe384")}</Button>
          </Link>
          <Link href="/what-am-i-owed">
            <Button variant="ghost">{tIapp_locale_compensation_claims_page("t_cb700000")}</Button>
          </Link>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-12">
          <LeadForm vertical="compensation-claims" />
        </div>
      </Reveal>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </VerticalPageShell>
  );
}
