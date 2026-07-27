import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui";
import { Zakameter } from "@/components/Zakameter";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { ToolIconTile } from "@/components/ToolIcon";
import { Globe } from "lucide-react";
import { formatAgorot } from "@/lib/money";
import { isIsrael, getCountry } from "@/lib/geo";
import { bcp47, type Locale } from "@/i18n/config";

export const revalidate = 3600;

async function loadProof() {
  try {
    const [agg, count] = await Promise.all([
      prisma.savingsProof.aggregate({ _sum: { savingMonthly: true } }),
      prisma.savingsProof.count({ where: { savingMonthly: { gt: 0 } } }),
    ]);
    return { monthlyAgorot: agg._sum.savingMonthly ?? 0, count };
  } catch {
    return { monthlyAgorot: 0, count: 0 };
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const proof = await loadProof();

  const steps = ["upload", "act", "pay"] as const;
  const trust = t.raw("home.trust") as string[];
  const israeliVisitor = await isIsrael();

  const visitorCountry = await getCountry();
  const countryTag = (() => {
    if (!visitorCountry) return "";
    try {
      const name = new Intl.DisplayNames([locale], { type: "region" }).of(visitorCountry);
      return name ? ` · ${name}` : "";
    } catch {
      return "";
    }
  })();

  const moneyLabel =
    locale === "he" ? "הכסף שלי" : locale === "ar" ? "أموالي" : locale === "ru" ? "Мои деньги" : "My money";

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      {!israeliVisitor && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[rgba(62,198,255,0.28)] bg-[rgba(62,198,255,0.06)] px-5 py-3.5 text-[13.5px] text-ink-soft leading-relaxed">
          <Globe size={18} className="shrink-0 text-[#3ec6ff]" aria-hidden />
          <span>{t("home.geoNote")}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-12 items-center">
        <div className="flex-1 min-w-[300px] basis-[400px]">
          <Reveal>
            <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-6">
              {t("home.kicker")}
              {countryTag}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(38px,5.6vw,56px)] leading-[1.12] m-0 text-balance">
              {t("home.title1")}
              <br />
              <span className="grad-text">{t("home.title2")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-ink-soft text-[17px] leading-[1.75] my-7 max-w-[480px]">
              {t("home.sub")}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap gap-3 items-center">
              <Link href="/money">
                <Button>{moneyLabel}</Button>
              </Link>
              <Link href="/what-am-i-owed">
                <Button variant="ghost">{t("nav.whatAmIOwed")}</Button>
              </Link>
              <Link href="/check">
                <Button variant="ghost">{t("home.cta")}</Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <ul className="flex flex-col gap-2 mt-7 list-none p-0 m-0">
              {trust.map((line) => (
                <li key={line} className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
                  <span className="text-emerald font-black" aria-hidden>
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={160} className="flex-1 min-w-[320px] basis-[380px]">
          <Zakameter bcp47={bcp47[locale as Locale]} />
        </Reveal>
      </div>

      <Reveal delay={80}>
        <div className="mt-12 grid grid-cols-3 gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-4 py-5">
          {(t.raw("home.stats") as Array<{ n: string; label: string }>).map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display grad-text text-[clamp(24px,6vw,34px)] leading-none tabular-nums">
                {s.n}
              </div>
              <div className="text-ink-soft text-[11.5px] mt-1.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {proof.count > 0 && (
        <Reveal>
          <div className="mt-14 text-center rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-6 py-5">
            <span className="font-display grad-text text-3xl">
              {formatAgorot(proof.monthlyAgorot, bcp47[locale as Locale])}
            </span>
            <span className="block text-[13px] text-ink-soft mt-1.5">
              {t("home.proof", { count: proof.count })}
            </span>
          </div>
        </Reveal>
      )}

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-1.5">{t("home.verticalsTitle")}</h2>
        <p className="text-ink-soft text-[13px] mt-0 mb-2">{t("home.verticalsSub")}</p>
      </Reveal>
      {(
        [
          {
            group: "moneyBack",
            items: [
              { key: "lostmoney", href: "/lost-money" },
              { key: "classaction", href: "/class-action" },
              { key: "childsavings", href: "/child-savings" },
              { key: "arnona", href: "/arnona" },
              { key: "disability", href: "/disability-benefits" },
              { key: "defects", href: "/construction-defects" },
              { key: "carvalue", href: "/car-value" },
              { key: "mortins", href: "/mortgage-insurance" },
              { key: "dupinsurance", href: "/duplicate-insurance" },
              { key: "pension", href: "/pension-fees" },
              { key: "mortgage", href: "/mortgage" },
              { key: "taxrefund", href: "/taxrefund" },
              { key: "flights", href: "/flights" },
              { key: "baggage", href: "/baggage" },
              { key: "priceprotection", href: "/price-protection" },
              { key: "parking", href: "/parking" },
            ],
          },
          {
            group: "rightsWork",
            items: [
              { key: "rights", href: "/rights" },
              { key: "payslip", href: "/payslip" },
              { key: "severance", href: "/severance" },
              { key: "maternity", href: "/maternity" },
              { key: "unemployment", href: "/unemployment" },
              { key: "miluim", href: "/miluim" },
            ],
          },
          {
            group: "consumer",
            items: [
              { key: "mobile", href: "/check" },
              { key: "subs", href: "/money" },
              { key: "electricity", href: "/electricity" },
              { key: "bankfees", href: "/bank-fees" },
              { key: "warranty", href: "/warranty" },
              { key: "deposit", href: "/deposit" },
              { key: "deals", href: "/deals" },
            ],
          },
          {
            group: "business",
            items: [{ key: "vat", href: "/vat" }],
          },
        ] as const
      ).map((section) => (
        <div key={section.group} className="mt-8 first:mt-5">
          <Reveal>
            <div className="text-[12.5px] font-extrabold text-emerald uppercase tracking-wide mb-3.5">
              {t(`home.verticalGroups.${section.group}`)}
            </div>
          </Reveal>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {section.items.map((v, i) => (
              <Reveal key={v.key} delay={i * 60}>
                <Link href={v.href} className="no-underline text-ink block h-full">
                  <SpotlightCard className="p-5 h-full transition-colors duration-200 hover:border-[rgba(63,203,155,0.4)]">
                    <ToolIconTile name={v.key} />
                    <div className="font-extrabold text-[15px] mt-2.5">
                      {t(`home.verticals.${v.key}.title`)}
                    </div>
                    <div className="text-ink-soft text-[12.5px] mt-1 leading-relaxed">
                      {t(`home.verticals.${v.key}.sub`)}
                    </div>
                  </SpotlightCard>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      ))}

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.howTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {steps.map((key, i) => (
          <Reveal key={key} delay={i * 90}>
            <SpotlightCard className="p-6 h-full">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                  {i + 1}
                </div>
              </div>
              <div className="font-extrabold text-base mt-3">{t(`onboarding.steps.${key}.title`)}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
                {t(`onboarding.steps.${key}.sub`)}
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.whyTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {(["alone", "services", "zakai"] as const).map((col, i) => (
          <Reveal key={col} delay={i * 90}>
            <SpotlightCard
              className={`p-6 h-full ${col === "zakai" ? "border-[rgba(63,203,155,0.45)]" : ""}`}
            >
              <div className={`font-extrabold text-[15px] ${col === "zakai" ? "text-emerald" : ""}`}>
                {t(`home.why.${col}.title`)}
              </div>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {(t.raw(`home.why.${col}.points`) as string[]).map((p) => (
                  <li key={p} className="flex gap-2.5 items-start text-[13px] text-ink-soft leading-relaxed">
                    <span
                      className={`font-black shrink-0 ${col === "zakai" ? "text-emerald" : "text-[rgba(147,166,165,0.6)]"}`}
                      aria-hidden
                    >
                      {col === "zakai" ? "✓" : "•"}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <p className="mt-10 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[560px] mx-auto">
        {t("home.scopeNote")}
      </p>
    </main>
  );
}
