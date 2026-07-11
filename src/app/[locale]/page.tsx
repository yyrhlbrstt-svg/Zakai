import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { HomeCalculator } from "@/components/HomeCalculator";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const steps = ["upload", "act", "pay"] as const;

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-20 pt-2">
      <div className="flex flex-wrap gap-10 items-center">
        <div className="flex-1 min-w-[300px] basis-[400px]">
          <div className="inline-block text-[12.5px] font-extrabold tracking-[0.1em] text-cyan bg-[rgba(62,198,255,0.1)] border border-[rgba(62,198,255,0.3)] rounded-full px-3.5 py-1.5 mb-5">
            {t("home.kicker")}
          </div>
          <h1 className="font-display text-[clamp(36px,5.5vw,54px)] leading-[1.13] m-0">
            {t("home.title1")}
            <br />
            <span className="grad-text">{t("home.title2")}</span>
          </h1>
          <p className="text-ink-soft text-[17px] leading-[1.7] my-6 max-w-[480px]">
            {t("home.sub")}
          </p>
          <Link href="/check">
            <Button>{t("home.cta")}</Button>
          </Link>
          <p className="text-[12.5px] text-ink-soft mt-6 max-w-[460px] leading-relaxed">
            {t("home.scopeNote")}
          </p>
        </div>

        <div className="flex-1 min-w-[320px] basis-[380px]">
          <HomeCalculator />
        </div>
      </div>

      <h2 className="text-[17px] font-extrabold mt-12 mb-3.5">{t("home.howTitle")}</h2>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {steps.map((key, i) => (
          <Card key={key} className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                {i + 1}
              </div>
            </div>
            <div className="font-extrabold text-base mt-3">
              {t(`onboarding.steps.${key}.title`)}
            </div>
            <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
              {t(`onboarding.steps.${key}.sub`)}
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed">
        {t("disclosure.agent")} {t("disclosure.noGuarantee")}
      </p>
    </main>
  );
}
