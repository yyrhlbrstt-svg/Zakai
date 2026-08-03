import { Link } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { loadTrillionGatesReport } from "@/lib/services/trillionGates";
import { domainsGravityLinks } from "@/lib/marketing/domainsGravityCopy";

/**
 * Honest control-phase strip — real gate counters, never a valuation claim.
 */
export async function ControlGatesStrip({ locale }: { locale: string }) {
  const copy = domainsGravityLinks(locale);
  const origin = SITE_URL.replace(/\/+$/, "");
  let phase = "skeleton";
  let passed = 0;
  let total = 9;
  let next = "";
  let disclaimer = "";

  try {
    const report = await loadTrillionGatesReport(origin);
    phase = report.phase;
    passed = report.gatesPassed;
    total = report.gatesTotal;
    next = report.nextBlocker;
    disclaimer = report.disclaimer;
  } catch {
    next = "Gates temporarily unavailable.";
    disclaimer =
      "Gates measure protocol gravity and adoption readiness. They are not a valuation.";
  }

  return (
    <section className="border border-[rgba(63,203,155,0.3)] rounded-2xl p-5 mb-10 bg-[rgba(63,203,155,0.05)]">
      <h2 className="text-[15px] font-extrabold m-0 mb-1">{copy.title}</h2>
      <p className="text-[13px] text-ink-soft m-0 mb-3 font-mono" dir="ltr">
        phase={phase} · gates {passed}/{total}
      </p>
      {next ? (
        <p className="text-[13px] leading-relaxed m-0 mb-3 text-ink">
          {locale === "he" || locale === "ar" ? "החסימה הבאה: " : "Next blocker: "}
          {next}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 text-[12.5px] font-bold">
        <a
          href={`${origin}/api/network/monopoly`}
          className="text-emerald no-underline"
          rel="noopener noreferrer"
        >
          {copy.monopoly}
        </a>
        <a
          href={`${origin}/api/network/trillion-gates`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          {copy.gates}
        </a>
        <a
          href={`${origin}/api/network/indispensability`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          {copy.indispensability}
        </a>
        <a
          href={`${origin}/.well-known/zakai-agent-economy.json`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          {copy.agents}
        </a>
        <a
          href={`${origin}/.well-known/zakai-fairness-certified.json`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          {copy.fairness}
        </a>
        <a
          href={`${origin}/api/institution/ignore-cost`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          {copy.ignoreCost}
        </a>
        <Link href="/must-have" className="text-ink-soft no-underline hover:text-emerald">
          {copy.mustHave}
        </Link>
      </div>
      {disclaimer ? (
        <p className="text-[11px] text-ink-soft/80 mt-3 mb-0 leading-relaxed">{disclaimer}</p>
      ) : null}
    </section>
  );
}
