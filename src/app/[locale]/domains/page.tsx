import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { buildDomainsDocument } from "@/lib/protocol/domains";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { CollectiveIntentForm } from "@/components/CollectiveIntentForm";
import { getVisitorMarket } from "@/lib/global/visitorMarket";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "domainsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/domains") },
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
    <VerticalPageShell title={t("title")} sub={t("sub")} width="wide">
      <p className="text-[13px] text-ink-soft mb-8">
        <a href={`${SITE_URL}/.well-known/zakai-domains.json`} className="text-emerald font-bold no-underline">
          zakai-domains.json
        </a>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-12">
        {doc.domains.map((d) => (
          <Card key={d.id} className="p-5">
            <div className="flex justify-between gap-2 mb-2">
              <h2 className="text-[16px] font-extrabold m-0">{d.name}</h2>
              <span className="text-[10px] uppercase font-bold text-emerald">{d.status}</span>
            </div>
            <p className="text-[13px] text-ink-soft m-0 mb-2">{d.tagline}</p>
            <p className="text-[11.5px] text-ink-soft/80 m-0 mb-3 leading-relaxed">{d.honesty}</p>
            {d.reference_routes?.[0] && (
              <Link href={d.reference_routes[0]} className="text-[13px] font-bold text-emerald no-underline">
                {t("tryIt")}
              </Link>
            )}
          </Card>
        ))}
      </div>

      <section className="border-t border-[rgba(255,255,255,0.08)] pt-10">
        <h2 className="text-lg font-extrabold mb-2">{t("collectiveTitle")}</h2>
        <p className="text-[13px] text-ink-soft mb-4 max-w-[560px]">{t("collectiveSub")}</p>
        <CollectiveIntentForm market={market} />
      </section>
    </VerticalPageShell>
  );
}
