/**
 * Fairness Certified — machine discovery for the program spec.
 * Empty certified_providers until real MIN_SAMPLE scores exist + legal review.
 */

export function buildFairnessCertifiedDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: "zakai-fairness-certified",
    version: "2026-08-03",
    status: "spec_only" as const,
    name: "Zakai Fairness Certified",
    tagline:
      "Partners may embed fairness metrics only when a provider has a real MIN_SAMPLE score — never fabricated stars.",
    laws: [
      "No score below MIN_SAMPLE.",
      "No user reviews or LLM opinions as fairness.",
      "Program mark requires legal review before public «certified» badges.",
    ],
    endpoints: {
      scores: `${base}/api/fairness/scores?market=IL`,
      companies: `${base}/he/companies`,
      widget_validate: `${base}/api/widget/validate`,
      discovery: `${base}/.well-known/zakai-fairness-certified.json`,
    },
    embed: {
      script: `${base}/embed.js`,
      docs: "docs/WIDGET_EMBED.md",
      program: "docs/FAIRNESS_CERTIFIED_PROGRAM.md",
    },
    /** Populated only from live fairness API when scores exist — always start empty in the static doc. */
    certified_providers: [] as { market: string; provider: string; note: string }[],
    honesty:
      "certified_providers stays empty in this discovery document until ops syncs real scored providers after legal review. Check /api/fairness/scores for live data.",
  };
}
