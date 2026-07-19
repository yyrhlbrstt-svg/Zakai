import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { evaluateRights, type RightsProfile } from "@/lib/rights";

export const metadata: Metadata = {
  title: "New to Israel? The money you're owed — Zakai",
  description:
    "New immigrants (olim) are entitled to tax breaks, absorption benefits, arnona discounts and more — most go unclaimed. Zakai checks what you're owed, in English.",
};

/** A representative new-immigrant profile to surface the olim-relevant rights. */
const OLIM_PROFILE: RightsProfile = {
  ageGroup: "25_44",
  employment: "employee",
  children: 0,
  childrenUnder6: 0,
  renting: true,
  lowIncome: false,
  newImmigrant: true,
  dischargedSoldier: false,
  reservist: false,
  disability: false,
};

/**
 * The olim wedge: an English-first funnel for the affluent, underserved
 * English-speaking new-immigrant market. Reuses the deterministic rights
 * engine — no new benefit data to keep accurate, just a targeted framing.
 */
export default async function OlimPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // Show the immigrant-relevant matches first, then the rest — all from the
  // existing, accurate rights catalog.
  const { matches } = evaluateRights(OLIM_PROFILE);
  const olimFirst = [...matches].sort((a, b) => {
    const aImm = a.id.includes("oleh") ? 0 : 1;
    const bImm = b.id.includes("oleh") ? 0 : 1;
    return aImm - bImm;
  });

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-6">
      <div className="max-w-[620px]">
        <Reveal>
          <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
            {t("olim.kicker")}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(30px,5.4vw,46px)] leading-[1.14] m-0 text-balance">
            {t("olim.title")}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="text-ink-soft text-[16px] leading-[1.7] my-6">{t("olim.sub")}</p>
        </Reveal>
        <Reveal delay={240}>
          <div className="flex flex-wrap gap-3">
            <Link href="/entitlements">
              <Button>{t("olim.cta")}</Button>
            </Link>
            <Link href="/taxrefund">
              <Button variant="ghost">{t("olim.ctaTax")}</Button>
            </Link>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("olim.listTitle")}</h2>
      </Reveal>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {olimFirst.map((e, i) => {
          const isImm = e.id.includes("oleh");
          return (
            <Reveal key={e.id} delay={Math.min(i * 40, 320)}>
              <SpotlightCard className={`p-4 h-full ${isImm ? "border-[rgba(63,203,155,0.4)]" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[14px]">{t(`rights.items.${e.id}.title`)}</span>
                  {isImm && (
                    <span className="text-[10px] font-extrabold text-emerald border border-[rgba(63,203,155,0.4)] rounded-full px-2 py-0.5 shrink-0">
                      {t("olim.badge")}
                    </span>
                  )}
                </div>
                <p className="text-ink-soft text-[12px] leading-relaxed mt-1.5 mb-0">
                  {t(`rights.items.${e.id}.desc`)}
                </p>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-10 text-[11.5px] text-[rgba(147,166,165,0.7)] leading-relaxed max-w-[620px]">
        {t("olim.disclaimer")}
      </p>
    </main>
  );
}
