import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button, Card } from "@/components/ui";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { fairnessCertifiedPageCopy } from "@/lib/monopoly/joinNetworkCopy";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import { buildFairnessCertifiedDocument } from "@/lib/monopoly/fairnessCertified";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = fairnessCertifiedPageCopy(locale);
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    alternates: { languages: alternateLanguages("/fairness-certified") },
  };
}

export default async function FairnessCertifiedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = fairnessCertifiedPageCopy(locale);
  const scores = await loadFairnessScores("IL").catch(() => []);
  const doc = buildFairnessCertifiedDocument(SITE_URL, { market: "IL", scores });

  return (
    <VerticalPageShell
      heroGlow
      className="max-w-[720px] mx-auto px-5 pb-24 pt-4 relative"
      kicker={c.kicker}
      title={c.title}
      sub={c.sub}
    >
      <Card className="p-5 mb-6">
        {doc.certified_providers.length === 0 ? (
          <p className="text-[13.5px] text-ink-soft m-0 leading-relaxed">{c.empty}</p>
        ) : (
          <>
            <p className="text-[13px] font-extrabold text-ink m-0 mb-3">{c.live}</p>
            <ul className="m-0 pl-5 text-[13px] text-ink-soft space-y-1">
              {doc.certified_providers.map((p) => (
                <li key={`${p.market}-${p.provider}`}>
                  {p.provider} — {p.fairnessScore}/100 (n={p.observations})
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <h2 className="text-[15px] font-extrabold mb-2">{c.embedTitle}</h2>
      <pre tabIndex={0} className="text-[11.5px] leading-relaxed bg-[rgba(0,0,0,0.04)] p-4 rounded-lg overflow-x-auto mb-6 whitespace-pre-wrap">
        {doc.embed.snippet}
      </pre>

      <p className="text-[12px] text-ink-soft mb-6">{c.legal}</p>

      <div className="flex flex-wrap gap-3">
        <a href={`${SITE_URL}/api/fairness/certified?market=IL`} className="no-underline">
          <Button>{c.api}</Button>
        </a>
        <Link href="/partners">
          <Button variant="ghost">{c.partners}</Button>
        </Link>
        <Link href="/join-network">
          <Button variant="ghost">Join network</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
