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
    prisma.case.count({ where: { status: "SAVED" } }).catch(() => 0),
    prisma.authorization.count({ where: { status: "ACTIVE" } }).catch(() => 0),
  ]);

  const verifiedMonthly = formatAgorot(proof.verifiedMinor, loc);
  const readiness = buildReadinessSnapshot();

  const bullets = t.raw("bullets") as string[];

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-6" dir={locale === "he" || locale === "ar" ? "rtl" : "ltr"}>
      <Reveal>
        <p className="text-[12px] uppercase tracking-wide text-emerald font-bold mb-2">{t("kicker")}</p>
        <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">{t("title")}</h1>
        <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[620px]">{t("sub")}</p>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <StatCard label={t("statVerified")} value={verifiedMonthly} hint={t("statVerifiedHint", { count: proof.verifiedCount })} />
          <StatCard label={t("statSaved")} value={String(savedCases)} hint={t("statSavedHint")} />
          <StatCard label={t("statMandates")} value={String(mandateCount)} hint={t("statMandatesHint")} />
        </div>
        <p className="text-[11.5px] text-ink-soft mt-3 leading-relaxed">{t("statDisclaimer")}</p>
        <p className="text-[13px] text-ink-soft mt-4 font-mono">
          {t("deployScore", { score: readiness.operationalScore, tier: readiness.tier })}
        </p>
      </Reveal>

      <Reveal delay={100}>
        <h2 className="font-display text-xl mt-12 mb-3">{t("verifyTitle")}</h2>
        <ul className="list-disc ps-5 flex flex-col gap-2 text-[14px] text-ink-soft leading-relaxed">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <pre className="mt-4 text-[11.5px] overflow-x-auto p-3 rounded-lg bg-[#060b12] border border-[rgba(255,255,255,0.08)] text-ink-soft">
          {`curl -s ${ORIGIN}/.well-known/zakai-trust-registry.json | head -c 500`}
        </pre>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/integrations"
            className="inline-block text-emerald font-extrabold text-[14px] no-underline border border-[rgba(63,203,155,0.4)] rounded-xl px-5 py-2.5"
          >
            {t("ctaIntegrations")}
          </Link>
          <Link
            href="/proofs"
            className="inline-block text-ink-soft font-bold text-[14px] no-underline border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-2.5"
          >
            {t("ctaProofs")}
          </Link>
          <a
            href={`${ORIGIN}/api/network/readiness`}
            className="inline-block text-ink-soft font-bold text-[14px] no-underline border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-2.5"
          >
            {t("ctaReadiness")}
          </a>
        </div>
        <p className="text-[12.5px] text-ink-soft mt-6 leading-relaxed">{t("inboundNote")}</p>
      </Reveal>
    </main>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
      <div className="text-[11px] font-extrabold text-ink-soft uppercase tracking-wide">{label}</div>
      <div className="font-display text-2xl mt-1 grad-text">{value}</div>
      <div className="text-[11.5px] text-ink-soft mt-1 leading-snug">{hint}</div>
    </div>
  );
}
