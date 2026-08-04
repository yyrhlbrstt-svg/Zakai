import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { provenSavings } from "@/lib/services/selfReportedSaving";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";
import { buildZmlCatalogForMarket } from "@/lib/protocol/zml/catalog";
import { SITE_URL, defaultOpenGraph } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const title = t("metaTitle");
  const description = t("metaDesc");
  return {
    title,
    description,
    openGraph: defaultOpenGraph(locale, { title, description, path: "/about" }),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const proof = await provenSavings();
  const ilRights = await buildZmlCatalogForMarket(SITE_URL, "IL");
  const ilRightsCount = ilRights.length;
  const cols = ["alone", "services", "zakai"] as const;

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-4">
      <h1 className="font-display text-[clamp(30px,4.5vw,40px)] mt-4">{t("title")}</h1>
      <p className="text-ink-soft text-[15px] mt-3 mb-8 max-w-[600px] leading-relaxed">{t("subtitle")}</p>

      <Reveal>
        <div className="rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-6 py-5 mb-10">
          <p className="text-[14px] text-ink-soft m-0 leading-relaxed">{t("proofPitch")}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/proofs">
              <Button variant="ghost" className="!text-[13px]">
                {t("proofsCta")}
              </Button>
            </Link>
            <Link href="/results">
              <Button variant="ghost" className="!text-[13px]">
                {t("resultsCta")}
              </Button>
            </Link>
          </div>
          {proof.verifiedCount > 0 && (
            <p className="text-[13px] mt-4 mb-0">
              <span className="font-display grad-text text-2xl">
                {formatAgorot(proof.verifiedMinor, bcp47[locale as Locale])}
              </span>
              <span className="text-ink-soft block mt-1">
                {t("proof", { count: proof.verifiedCount })}
              </span>
            </p>
          )}
        </div>
      </Reveal>

      <h2 className="text-[17px] font-extrabold mb-4">{t("whyTitle")}</h2>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] mb-10">
        {cols.map((col) => {
          const isZakai = col === "zakai";
          const points = (t.raw(`why.${col}.points`) as string[]) || [];
          return (
            <SpotlightCard
              key={col}
              className={`p-6 h-full min-h-[200px] ${isZakai ? "border-[rgba(63,203,155,0.45)]" : ""}`}
            >
              <div className={isZakai ? "font-extrabold text-[15px] text-emerald" : "font-extrabold text-[15px]"}>
                {t(`why.${col}.title`)}
              </div>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {points.map((p) => (
                  <li key={p} className="flex gap-2.5 items-start text-[13px] text-ink-soft leading-relaxed">
                    <span className={isZakai ? "font-black shrink-0 text-emerald" : "font-black shrink-0 text-[rgba(147,166,165,0.6)]"} aria-hidden>
                      {isZakai ? "✓" : "•"}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          );
        })}
      </div>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mb-3">{t("catalogTitle")}</h2>
        <p className="text-ink-soft text-[14px] leading-relaxed mb-4">
          {t("catalogBody", { count: ilRightsCount })}
        </p>
        <Link href="/rights">
          <Button>{t("rightsCta")}</Button>
        </Link>
      </Reveal>

      <Reveal>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/trust">
            <Button variant="ghost">{t("trustCta")}</Button>
          </Link>
          <Link href="/protocol">
            <Button variant="ghost">{t("protocolCta")}</Button>
          </Link>
          <Link href="/money">
            <Button>{t("startCta")}</Button>
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
