import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { alternateLanguages } from "@/lib/seo";
import { buildRegulatorySnapshot } from "@/lib/regulatory/buildSnapshot";
import { agorotToShekels } from "@/lib/money";

// Must render per-request, not be baked into a static build — a build-time
// snapshot would freeze the report's numbers at whatever they were when
// Vercel last built, silently going stale as real cases/outcomes accrue.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Zakai regulatory snapshot — citable report",
    description:
      "A single printable, citable page of documented Zakai aggregates: outcome graph, inbound institutional pressure, and fairness-score coverage.",
    alternates: { languages: alternateLanguages("/regulatory/report") },
    robots: { index: true, follow: true },
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function RegulatoryReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { market: marketParam } = await searchParams;
  const market = (marketParam || "IL").toUpperCase();
  const snapshot = await buildRegulatorySnapshot(market);
  const generatedAt = new Date().toISOString();

  return (
    <>
      <style>{`
        .reg-report { max-width: 760px; margin: 0 auto; padding: 48px 20px 96px; color: #e8ece9; font-family: ui-sans-serif, system-ui, sans-serif; }
        .reg-report h1 { font-size: 26px; margin: 0 0 6px; }
        .reg-report h2 { font-size: 17px; margin: 32px 0 10px; }
        .reg-report .meta { color: #9aa39c; font-size: 13px; margin-bottom: 24px; }
        .reg-report .disclaimer { border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #c7cec9; background: rgba(255,255,255,0.03); }
        .reg-report .honesty { border-color: rgba(230,180,60,0.5); color: #e6c04a; }
        .reg-report table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-top: 8px; }
        .reg-report th, .reg-report td { text-align: left; padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .reg-report th { color: #9aa39c; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
        .reg-report .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 8px; }
        .reg-report .stat { border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; }
        .reg-report .stat .n { font-size: 22px; font-weight: 800; display: block; }
        .reg-report .stat .l { font-size: 12px; color: #9aa39c; }
        .reg-report .links { margin-top: 40px; font-size: 12.5px; color: #9aa39c; }
        .reg-report .links a { color: #9aa39c; margin-inline-end: 14px; }
        @media print {
          .reg-report { color: #000; max-width: 100%; padding: 0; }
          .reg-report .disclaimer { border-color: #999; background: none; color: #333; }
          .reg-report .honesty { border-color: #b8860b; color: #7a5c00; }
          .reg-report th, .reg-report td { border-color: #ccc; }
          .reg-report .stat { border-color: #ccc; }
          .reg-report .links { display: none; }
        }
      `}</style>
      <main className="reg-report">
        <h1>Zakai regulatory snapshot — {market}</h1>
        <p className="meta">
          Schema {snapshot.schema} · v{snapshot.schemaVersion} · generated {generatedAt}
        </p>
        <p className={`disclaimer${snapshot.isEmpty ? " honesty" : ""}`}>
          {snapshot.isEmpty
            ? "Honesty: all aggregates below are zero/empty. Do not cite this page as a market statistic — it reflects no documented Zakai activity yet."
            : snapshot.disclaimer}
        </p>

        <h2>Outcome graph (de-identified)</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="n">{fmt(snapshot.outcomeGraph.totalOutcomesGlobal)}</span>
            <span className="l">Documented outcomes, all markets</span>
          </div>
        </div>
        {snapshot.outcomeGraph.marketSlice.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Trials</th>
                <th>Paid</th>
                <th>Win rate</th>
                <th>Recovered (₪)</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outcomeGraph.marketSlice.map((m) => (
                <tr key={m.market}>
                  <td>{m.market}</td>
                  <td>{fmt(m.trials)}</td>
                  <td>{fmt(m.paidCount)}</td>
                  <td>{m.winRate === null ? "—" : `${Math.round(m.winRate * 100)}%`}</td>
                  <td>{fmt(agorotToShekels(m.totalRecoveredMinor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Inbound institutional pressure (disclosed only)</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="n">{fmt(snapshot.inboundPressure.disclosedInstitutions)}</span>
            <span className="l">Institutions with disclosed pressure</span>
          </div>
        </div>
        {snapshot.inboundPressure.top.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Dispatched</th>
                <th>Saved</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.inboundPressure.top.map((p) => (
                <tr key={p.institutionId}>
                  <td>{p.institutionId}</td>
                  <td>{fmt(p.dispatchedCases)}</td>
                  <td>{fmt(p.savedCases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Fairness score coverage</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="n">{fmt(snapshot.fairnessScores.providersWithScore)}</span>
            <span className="l">Providers with a published score (min n={snapshot.fairnessScores.minObservations})</span>
          </div>
          <div className="stat">
            <span className="n">{fmt(snapshot.collectiveIntent.totalSignals)}</span>
            <span className="l">Collective intent signals (intent-only phase)</span>
          </div>
        </div>

        <div className="links">
          <a href={`/api/regulatory/snapshot?market=${market}`}>JSON</a>
          <a href={`/api/regulatory/snapshot?market=${market}&format=brief`}>Plain-text brief</a>
          <a href={`/api/regulatory/snapshot?market=${market}&format=md`}>Markdown</a>
          <a href="/regulatory">Journalist &amp; supervisor kit</a>
        </div>
      </main>
    </>
  );
}
