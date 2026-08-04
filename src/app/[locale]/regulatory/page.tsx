import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button, Card } from "@/components/ui";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { REGULATORY_SNAPSHOT_SCHEMA, REGULATORY_SNAPSHOT_VERSION } from "@/lib/regulatory/snapshotSchema";
import { regulatoryKitCopy } from "@/lib/marketing/regulatoryKitCopy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = regulatoryKitCopy(locale);
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    alternates: { languages: alternateLanguages("/regulatory") },
  };
}

export default async function RegulatoryKitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = regulatoryKitCopy(locale);

  return (
    <VerticalPageShell
      kicker="Regulatory"
      title={c.title}
      sub={c.sub}
      className="max-w-[720px] mx-auto px-5 pb-24"
    >
      <Card className="p-6 mb-5">
        <p className="text-[13.5px] text-ink-soft leading-relaxed m-0">
          {c.schemaNote(REGULATORY_SNAPSHOT_SCHEMA, REGULATORY_SNAPSHOT_VERSION)}
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <a href={`${SITE_URL}/api/regulatory/snapshot?market=IL&format=brief`} className="no-underline">
          <Button className="w-full">{c.briefCta}</Button>
        </a>
        <a href={`${SITE_URL}/api/regulatory/snapshot?market=IL&format=md`} className="no-underline">
          <Button variant="ghost" className="w-full">
            {c.mdCta}
          </Button>
        </a>
        <a href={`${SITE_URL}/api/regulatory/snapshot?market=IL`} className="no-underline">
          <Button variant="ghost" className="w-full">
            {c.jsonCta}
          </Button>
        </a>
        <a href={`${SITE_URL}/api/network/join-kit`} className="no-underline">
          <Button variant="ghost" className="w-full">
            {c.joinKitCta}
          </Button>
        </a>
        <a href={`${SITE_URL}/api/institution/inbound-pressure`} className="no-underline">
          <Button variant="ghost" className="w-full">
            {c.pressureCta}
          </Button>
        </a>
        <a href={`${SITE_URL}/api/network/gravity`} className="no-underline">
          <Button variant="ghost" className="w-full">
            {c.gravityCta}
          </Button>
        </a>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/institutions">
          <Button variant="ghost" className="!text-[13px]">
            {c.institutions}
          </Button>
        </Link>
        <Link href="/network-proof">
          <Button variant="ghost" className="!text-[13px]">
            {c.network}
          </Button>
        </Link>
        <Link href="/domains">
          <Button variant="ghost" className="!text-[13px]">
            {c.domains}
          </Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
