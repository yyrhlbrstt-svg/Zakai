import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { alternateLanguages } from "@/lib/seo";
import { provenSavings } from "@/lib/services/selfReportedSaving";
import { prisma } from "@/lib/prisma";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";
import { Reveal } from "@/components/Reveal";
import { buildReadinessSnapshot } from "@/lib/network/readinessLayers";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { StatTile } from "@/components/StatTile";
import { CodeBlock } from "@/components/CodeBlock";
import { SectionHeading } from "@/components/SectionHeading";

export const dynamic = "force-dynamic";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "networkProof" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/network-proof") },
  };
}

/**
 * Public, inbound-only proof page for risk teams and AI platforms — real ledger
 * numbers where they exist, never invented traction.
 */
export default async function NetworkProofPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("networkProof");
  const loc = bcp47[locale as Locale];

  const [proof, savedCases, mandateCount] = await Promise.all([
    provenSavings(),
    // Only cases with a non-self-reported SavingsProof — estimate shortcuts must not pad this tile.
    prisma.case
      .count({
        where: {
          status: "SAVED",
          savingsProof: { is: { selfReported: false, savingMonthly: { gt: 0 } } },
        },
      })
      .catch(() => 0),
    prisma.authorization.count({ where: { status: "ACTIVE" } }).catch(() => 0),
  ]);

  const verifiedMonthly = formatAgorot(proof.verifiedMinor, loc);
  const readiness = buildReadinessSnapshot();

  const bullets = t.raw("bullets") as string[];

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      <Reveal delay={60}>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <StatTile label={t("statVerified")} value={verifiedMonthly} hint={t("statVerifiedHint", { count: proof.verifiedCount })} />
          <StatTile label={t("statSaved")} value={String(savedCases)} hint={t("statSavedHint")} />
          <StatTile label={t("statMandates")} value={String(mandateCount)} hint={t("statMandatesHint")} />
        </div>
        <p className="text-[11.5px] text-ink-soft mt-3 leading-relaxed">{t("statDisclaimer")}</p>
        <p className="text-[13px] text-ink-soft mt-4 font-mono">
          {t("deployScore", { score: readiness.operationalScore, tier: readiness.tier })}
        </p>
        <p className="text-[13px] text-ink-soft mt-2 font-mono">
          {t("consumerReleaseScore", {
            score: readiness.consumerReleaseScore,
            ready: readiness.canReleaseConsumerApp ? "yes" : "no",
          })}
        </p>
      </Reveal>

      <Reveal delay={100}>
        <SectionHeading title={t("verifyTitle")} className="mt-10 mb-3" />
        <ul className="list-disc ps-5 flex flex-col gap-2 text-[14px] text-ink-soft leading-relaxed">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <CodeBlock className="mt-4">
          {`curl -s ${ORIGIN}/.well-known/zakai-trust-registry.json | head -c 500`}
        </CodeBlock>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/integrations"
            className="inline-block text-emerald font-extrabold text-[14px] no-underline border border-[rgba(63,203,155,0.4)] rounded-xl px-5 py-2.5 hover:bg-[rgba(63,203,155,0.08)] transition-colors"
          >
            {t("ctaIntegrations")}
          </Link>
          <Link
            href="/proofs"
            className="inline-block text-ink-soft font-bold text-[14px] no-underline border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-2.5 hover:border-[rgba(255,255,255,0.2)] transition-colors"
          >
            {t("ctaProofs")}
          </Link>
          <a
            href={`${ORIGIN}/api/network/readiness`}
            className="inline-block text-ink-soft font-bold text-[14px] no-underline border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-2.5 hover:border-[rgba(255,255,255,0.2)] transition-colors"
          >
            {t("ctaReadiness")}
          </a>
        </div>
        <p className="text-[12.5px] text-ink-soft mt-6 leading-relaxed">{t("inboundNote")}</p>
      </Reveal>
    </VerticalPageShell>
  );
}
