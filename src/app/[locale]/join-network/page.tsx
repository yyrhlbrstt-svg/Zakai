import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button, Card } from "@/components/ui";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { joinNetworkCopy } from "@/lib/monopoly/joinNetworkCopy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = joinNetworkCopy(locale);
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    alternates: { languages: alternateLanguages("/join-network") },
  };
}

export default async function JoinNetworkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = joinNetworkCopy(locale);

  const cards = [
    {
      title: c.institutionTitle,
      body: c.institutionBody,
      href: "/institutions/quickstart",
      cta: c.institutionCta,
      external: null as string | null,
    },
    {
      title: c.issuerTitle,
      body: c.issuerBody,
      href: null,
      cta: c.issuerCta,
      external: `${SITE_URL}/api/mandate/delegation/evidence`,
    },
    {
      title: c.agentTitle,
      body: c.agentBody,
      href: null,
      cta: c.agentCta,
      external: `${SITE_URL}/.well-known/zakai-agents.json`,
    },
    {
      title: c.packsTitle,
      body: c.packsBody,
      href: null,
      cta: c.packsCta,
      external: `${SITE_URL}/api/cdn/packs/manifest.json`,
    },
  ];

  return (
    <VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[880px] mx-auto px-5 pb-28 pt-4 relative"
      kicker={c.kicker}
      title={c.title}
      sub={c.sub}
    >
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] mb-10">
        {cards.map((card) => (
          <Card key={card.title} className="p-5 flex flex-col">
            <div className="font-extrabold text-[15px] text-ink">{card.title}</div>
            <p className="text-[12.5px] text-ink-soft mt-2 mb-4 leading-relaxed flex-1">
              {card.body}
            </p>
            {card.href ? (
              <Link href={card.href} className="no-underline">
                <Button variant="ghost" className="!text-body w-full">
                  {card.cta}
                </Button>
              </Link>
            ) : (
              <a href={card.external!} className="no-underline">
                <Button variant="ghost" className="!text-body w-full">
                  {card.cta}
                </Button>
              </a>
            )}
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <a href={`${SITE_URL}/api/network/join-kit`} className="no-underline">
          <Button>{c.kitJson}</Button>
        </a>
        <Link href="/pipe" className="no-underline">
          <Button variant="ghost">{c.pipeCta}</Button>
        </Link>
        <a href={`${SITE_URL}/api/network/monopoly`} className="no-underline">
          <Button variant="ghost">{c.monopolyCta}</Button>
        </a>
        <a href={`${SITE_URL}/api/network/trillion-gates`} className="no-underline">
          <Button variant="ghost">{c.gates}</Button>
        </a>
        <Link href="/must-have">
          <Button variant="ghost">Must-have</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
