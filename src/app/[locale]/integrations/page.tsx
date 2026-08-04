import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { alternateLanguages } from "@/lib/seo";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { NumberedStepList } from "@/components/NumberedStepList";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { CodeBlock } from "@/components/CodeBlock";
import { SectionHeading } from "@/components/SectionHeading";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";
import { getOutcomeGraphPublicStats } from "@/lib/protocol/discovery";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "integrations" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/integrations") },
  };
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("integrations");
  const steps = t.raw("steps") as { title: string; body: string }[];
  const outcome = await getOutcomeGraphPublicStats();

  return (
    <VerticalPageShell
      heroGlow
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
    >
      <Reveal>
        <NumberedStepList
          steps={steps.map((s) => ({ title: s.title, body: s.body }))}
          variant="sections"
        />
      </Reveal>

      <Reveal delay={60}>
        <SpotlightCard className="p-5 mt-8 border-[rgba(63,203,155,0.4)]">
          <SectionHeading title={t("readyTitle")} className="mt-0 mb-2" as="h2" />
          <p className="text-[14px] text-ink-soft leading-relaxed m-0 mb-3">{t("readyBody")}</p>
          <CodeBlock>{`npx zakai-mandate-ready --origin ${ORIGIN}\n# or\ncurl -s ${ORIGIN}/api/mandate/ready`}</CodeBlock>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/institutions/quickstart" className="text-emerald font-bold underline">
              {t("readyQuickstart")}
            </Link>
            <Link href="/institutions/leader" className="text-emerald font-bold underline">
              {t("readyPioneer")}
            </Link>
          </div>
        </SpotlightCard>
      </Reveal>

      <Reveal delay={80}>
        <EmeraldInfoPanel className="mt-10">
          <strong className="text-emerald">{t("linksTitle")}</strong>
          <ul className="mt-2 mb-0 ps-5 list-disc flex flex-col gap-1.5">
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/ready`}>
                /api/mandate/ready
              </a>
              {" — "}
              {t("readyLinkHint")}
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/.well-known/zakai-jwks.json`}>
                /.well-known/zakai-jwks.json
              </a>
              {" — "}
              {t("jwksLinkHint")}
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/.well-known/zakai-mandate.json`}>
                zakai-mandate.json
              </a>
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/.well-known/zakai-trust-registry.json`}>
                zakai-trust-registry.json
              </a>
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/test-vectors`}>
                /api/mandate/test-vectors
              </a>
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/verify`}>
                POST /api/mandate/verify
              </a>
              {" — "}
              {t("verifyLinkHint")}
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/decide`}>
                POST /api/mandate/decide
              </a>
              {" — "}
              {t("decideLinkHint")}
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/status`}>
                GET /api/mandate/status/{"{jti}"}
              </a>
              {" — "}
              {t("statusLinkHint")}
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/revocations`}>
                /api/mandate/revocations
              </a>
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/mandate/conformance/probe`}>
                POST /api/mandate/conformance/probe
              </a>
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/network/opportunity-map`}>
                /api/network/opportunity-map
              </a>
            </li>
            <li>
              <a className="text-emerald underline break-all" href={`${ORIGIN}/api/network/readiness`}>
                /api/network/readiness
              </a>
            </li>
          </ul>
        </EmeraldInfoPanel>
      </Reveal>

      <Reveal delay={100}>
        <SpotlightCard className="p-5 mt-8">
          <SectionHeading title={t("proofTitle")} className="mt-0 mb-2" as="h2" />
          <p className="text-[14px] text-ink-soft leading-relaxed m-0 mb-3">{t("proofBody")}</p>
          <CodeBlock>{`ORIGIN=${ORIGIN}\n${t("proofCurl")}`}</CodeBlock>
        </SpotlightCard>
      </Reveal>

      <Reveal delay={110}>
        <SpotlightCard className="p-5 mt-8 border-[rgba(139,92,246,0.25)]">
          <SectionHeading title={t("outcomeGraphTitle")} className="mt-0 mb-2" as="h2" />
          <p className="text-[14px] text-ink-soft leading-relaxed m-0 mb-3">{t("outcomeGraphBody")}</p>
          {outcome.totalOutcomes === 0 ? (
            <p className="text-[13px] text-ink-soft m-0 mb-3">{t("outcomeGraphEmpty")}</p>
          ) : (
            <ul className="list-none p-0 m-0 mb-3 flex flex-col gap-1.5 text-[13px]">
              <li className="font-extrabold text-emerald">
                {t("outcomeGraphTotal", { count: outcome.totalOutcomes })}
              </li>
              {outcome.markets.slice(0, 5).map((m) => (
                <li key={m.market} className="text-ink-soft" dir="ltr">
                  {m.market}: {t("outcomeGraphMarket", {
                    trials: m.trials,
                    winPct:
                      m.winRate == null ? "—" : `${Math.round(m.winRate * 100)}%`,
                  })}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <a
              className="text-emerald font-bold underline break-all"
              href={`${ORIGIN}/api/network`}
              target="_blank"
              rel="noreferrer"
            >
              /api/network
            </a>
            <a
              className="text-emerald font-bold underline break-all"
              href={`${ORIGIN}/.well-known/zakai-protocol.json`}
              target="_blank"
              rel="noreferrer"
            >
              zakai-protocol.json
            </a>
          </div>
          <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed">
            {t("outcomeGraphPrivacy")}
          </p>
        </SpotlightCard>
      </Reveal>

      <Reveal delay={120}>
        <p className="text-[14px] text-ink-soft mb-4 mt-8">{t("moreDetail")}</p>
        <Link href="/institutions" className="text-emerald font-bold underline">
          {t("institutionsCta")}
        </Link>
      </Reveal>
    </VerticalPageShell>
  );
}
