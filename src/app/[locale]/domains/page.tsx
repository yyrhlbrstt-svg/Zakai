import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { alternateLanguages, SITE_URL, defaultOpenGraph } from "@/lib/seo";
import { buildDomainsDocument } from "@/lib/protocol/domains";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { CollectiveIntentForm } from "@/components/CollectiveIntentForm";
import { CollectiveSummaryPanel } from "@/components/CollectiveSummaryPanel";
import { AutopilotStatusStrip } from "@/components/AutopilotStatusStrip";
import { MonopolyDomainCard } from "@/components/MonopolyDomainCard";
import { getVisitorMarket } from "@/lib/global/visitorMarket";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "domainsPage" });
  const title = t("metaTitle");
  const description = t("metaDesc");
  return {
    title,
    description,
    alternates: { languages: alternateLanguages("/domains") },
    openGraph: defaultOpenGraph(locale, { title, description, path: "/domains" }),
  };
}

export default async function DomainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "domainsPage" });
  const doc = buildDomainsDocument(SITE_URL);
  const market = await getVisitorMarket();

  return (
    <VerticalPageShell title={t("title")} sub={t("sub")} width="wide" kicker={t("kicker")}>
      <Card className="p-5 mb-8 border-emerald/35 bg-[rgba(63,203,155,0.06)]">
        <p className="text-[14px] leading-relaxed m-0 mb-3">{t("mandateBlurb")}</p>
        <div className="flex flex-wrap gap-4 text-[13px] font-bold">
          <Link href="/institutions" className="text-emerald no-underline">
            {t("mandateInstitutions")}
          </Link>
          <Link href="/agents" className="text-ink-soft no-underline hover:text-emerald">
            {t("mandateAgents")}
          </Link>
          <a
            href={`${SITE_URL}/api/interop?probe=1`}
            className="text-ink-soft no-underline hover:text-emerald"
            rel="noopener noreferrer"
          >
            {t("interopProbe")}
          </a>
          <a
            href={`${SITE_URL}/.well-known/zakai-domains.json`}
            className="text-ink-soft no-underline hover:text-emerald font-mono text-[12px]"
            rel="noopener noreferrer"
          >
            zakai-domains.json
          </a>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        {doc.domains.map((d) => (
          <MonopolyDomainCard
            key={d.id}
            domain={d}
            tryItLabel={t("tryIt")}
            endpointsLabel={t("endpointsLabel")}
            institutionHref="/institutions"
            institutionLabel={t("institutionCta")}
            developersHref="/partners"
            developersLabel={t("developersCta")}
          />
        ))}
      </div>

      <section className="border-t border-[rgba(255,255,255,0.08)] pt-10 mb-10">
        <h2 className="text-lg font-extrabold mb-2">{t("executionTitle")}</h2>
        <p className="text-[13px] text-ink-soft mb-4 max-w-[640px] leading-relaxed">{t("executionSub")}</p>
        <Link href="/standard" className="text-[13px] font-bold text-emerald no-underline">
          {t("executionStandard")} →
        </Link>
      </section>

      <section className="border-t border-[rgba(255,255,255,0.08)] pt-10 mb-10">
        <CollectiveSummaryPanel
          market={market}
          title={t("collectiveSummaryTitle")}
          sub={t("collectiveSummarySub")}
          totalLabel={t("collectiveTotal")}
          verticalLabel={t("collectiveVertical")}
          apiHint={t("collectiveApiHint")}
        />
        <h2 className="text-lg font-extrabold mb-2">{t("collectiveTitle")}</h2>
        <p className="text-[13px] text-ink-soft mb-4 max-w-[560px]">{t("collectiveSub")}</p>
        <CollectiveIntentForm market={market} />
      </section>

      <AutopilotStatusStrip
        title={t("autopilotTitle")}
        sub={t("autopilotSub")}
        manifestLabel={t("autopilotManifest")}
        lastRunLabel={t("autopilotLastRun")}
        neverLabel={t("autopilotNever")}
      />

      <p className="mt-10 text-[11.5px] text-ink-soft/70 text-center max-w-[560px] mx-auto leading-relaxed">
        {t("footerHonesty")}
      </p>
    </VerticalPageShell>
  );
}
