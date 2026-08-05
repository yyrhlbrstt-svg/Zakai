/**
 * Fairness Certified — machine discovery for the program.
 * certified_providers is filled only from live MIN_SAMPLE scores — never fabricated.
 */

import type { FairnessProviderScore } from "@/lib/fairnessScore";

export type CertifiedProviderEntry = {
  market: string;
  provider: string;
  fairnessScore: number;
  observations: number;
  note: string;
};

export function certifiedFromScores(
  market: string,
  scores: readonly FairnessProviderScore[],
): CertifiedProviderEntry[] {
  return scores.map((s) => ({
    market: market.toUpperCase(),
    provider: s.provider,
    fairnessScore: s.fairnessScore,
    observations: s.observations,
    note: "Live StrategyOutcome win-rate ≥ MIN_SAMPLE — not a legal certification mark.",
  }));
}

export function buildFairnessCertifiedDocument(
  origin: string,
  opts?: { market?: string; scores?: readonly FairnessProviderScore[] },
) {
  const base = origin.replace(/\/+$/, "");
  const market = (opts?.market ?? "IL").toUpperCase();
  const certified_providers = opts?.scores
    ? certifiedFromScores(market, opts.scores)
    : ([] as CertifiedProviderEntry[]);

  const hasLive = certified_providers.length > 0;

  return {
    spec: "zakai-fairness-certified",
    version: "2026-08-03",
    status: hasLive ? ("live_scores" as const) : ("spec_only" as const),
    name: "Zakai Fairness Certified",
    tagline:
      "Partners may embed fairness metrics only when a provider has a real MIN_SAMPLE score — never fabricated stars.",
    laws: [
      "No score below MIN_SAMPLE.",
      "No user reviews or LLM opinions as fairness.",
      "Program mark requires legal review before public «certified» badges.",
      "Discovery may list live_scores providers; that is not a trademark grant.",
    ],
    endpoints: {
      scores: `${base}/api/fairness/scores?market=${market}`,
      certified: `${base}/api/fairness/certified?market=${market}`,
      companies: `${base}/he/companies`,
      widget_validate: `${base}/api/widget/validate`,
      discovery: `${base}/.well-known/zakai-fairness-certified.json`,
      program_page: `${base}/he/fairness-certified`,
    },
    embed: {
      script: `${base}/widget/zakai-widget.js`,
      legacy_embed: `${base}/embed.js`,
      docs: "docs/WIDGET_EMBED.md",
      program: "docs/FAIRNESS_CERTIFIED_PROGRAM.md",
      snippet: `<div id="zakai-fairness" data-api-key="pk_live_YOUR_KEY" data-provider="ProviderKey" data-market="${market}"></div>
<script src="${base}/widget/zakai-widget.js" data-api-base="${base}/api" async></script>`,
    },
    certified_providers,
    honesty: hasLive
      ? "Providers listed below passed MIN_SAMPLE on de-identified outcomes. Still not a legal «certified» trademark until counsel review."
      : "certified_providers stays empty until real scored providers exist. Check /api/fairness/scores for live data — never invent scores for embeds.",
  };
}
