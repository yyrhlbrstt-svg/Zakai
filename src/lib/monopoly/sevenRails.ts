/**
 * Seven monopoly rails — machine-readable status from real counters only.
 * Human doctrine: docs/GLOBAL_MONOPOLY_PLAYBOOK.md
 */

import { assessFlywheel, type FlywheelInputs } from "./flywheel";
import { BARRIER_CATALOG } from "./barriers";

export const MONOPOLY_RAIL = {
  MANDATE: "mandate",
  ZML: "zml",
  OUTCOME_GRAPH: "outcome_graph",
  SWITCHING_INBOUND: "switching_inbound",
  REGULATORY: "regulatory",
  DISTRIBUTION: "distribution",
  CLOSED_LOOP: "closed_loop",
} as const;

export type MonopolyRailId = (typeof MONOPOLY_RAIL)[keyof typeof MONOPOLY_RAIL];

export type RailMaturity = "skeleton" | "usable" | "gravity" | "default";

export interface RailAssessment {
  id: MonopolyRailId;
  title: string;
  maturity: RailMaturity;
  /** 0–100 from real inputs; never estimated market share. */
  score: number;
  winCondition: string;
  evidence: string[];
}

export interface SevenRailsReport {
  assessedAt: string;
  flywheel: ReturnType<typeof assessFlywheel>;
  rails: RailAssessment[];
  /** Mean of rail scores — protocol readiness, not valuation. */
  infrastructureScore: number;
  barriers: typeof BARRIER_CATALOG;
  disclaimer: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function maturityFromScore(score: number): RailMaturity {
  if (score >= 75) return "default";
  if (score >= 45) return "gravity";
  if (score >= 20) return "usable";
  return "skeleton";
}

export interface SevenRailsInputs extends FlywheelInputs {
  /** Documented SavingsProof count (same as savedCases usually). */
  proofsDocumented: number;
  /** Markets with non-empty pack rights. */
  marketsWithCitedRights: number;
  /** Fairness providers currently scoring (above MIN_SAMPLE). */
  fairnessProvidersScored: number;
  /** Partner embeds / agent handoffs attributed (partnerRef non-null users). */
  attributedSignups: number;
  /** Whether origin packs mirror is shippable (always true in monorepo). */
  packsOriginMirror: boolean;
}

export function assessSevenRails(input: SevenRailsInputs): SevenRailsReport {
  const flywheel = assessFlywheel(input);

  const mandateScore = clamp(
    Math.log10(1 + input.activeAuthorizations) * 18 +
      (input.registryIssuersActive + input.delegatedIssuersActive) * 12,
  );
  const zmlScore = clamp(
    input.marketsWithCitedRights * 6 + (input.packsOriginMirror ? 25 : 0) + input.marketsWithPacks * 2,
  );
  const outcomeScore = clamp(
    Math.log10(1 + input.verifiedOutcomes) * 22 + input.fairnessProvidersScored * 8,
  );
  const switchingScore = clamp(
    Math.log10(1 + input.activeAuthorizations) * 15 + Math.log10(1 + input.savedCases) * 10 + 15,
  );
  const regulatoryScore = clamp(
    Math.log10(1 + input.verifiedOutcomes + input.savedCases) * 20 +
      (input.fairnessProvidersScored > 0 ? 20 : 5),
  );
  const distributionScore = clamp(
    Math.log10(1 + input.attributedSignups) * 25 + Math.log10(1 + input.savedCases) * 12 + 10,
  );
  const closedLoopScore = clamp(
    Math.log10(1 + input.proofsDocumented) * 28 + Math.log10(1 + input.savedCases) * 10,
  );

  const rails: RailAssessment[] = [
    {
      id: MONOPOLY_RAIL.MANDATE,
      title: "Mandate authority rail",
      maturity: maturityFromScore(mandateScore),
      score: mandateScore,
      winCondition: "≥2 registry issuers; institutions verify JWKS offline",
      evidence: [
        `active_authorizations=${input.activeAuthorizations}`,
        `registry_issuers=${input.registryIssuersActive}`,
        `delegated_issuers=${input.delegatedIssuersActive}`,
      ],
    },
    {
      id: MONOPOLY_RAIL.ZML,
      title: "ZML rights-as-data",
      maturity: maturityFromScore(zmlScore),
      score: zmlScore,
      winCondition: "Third-party engines load packs from CDN/origin by default",
      evidence: [
        `markets_with_packs=${input.marketsWithPacks}`,
        `markets_with_cited_rights=${input.marketsWithCitedRights}`,
        `origin_mirror=${input.packsOriginMirror}`,
      ],
    },
    {
      id: MONOPOLY_RAIL.OUTCOME_GRAPH,
      title: "Outcome graph / fairness",
      maturity: maturityFromScore(outcomeScore),
      score: outcomeScore,
      winCondition: "MIN_SAMPLE real outcomes for major counterparties",
      evidence: [
        `verified_outcomes=${input.verifiedOutcomes}`,
        `fairness_providers_scored=${input.fairnessProvidersScored}`,
      ],
    },
    {
      id: MONOPOLY_RAIL.SWITCHING_INBOUND,
      title: "Switching + institution inbound",
      maturity: maturityFromScore(switchingScore),
      score: switchingScore,
      winCondition: "Institution publishes how it accepts Mandate inbound",
      evidence: [`authorizations=${input.activeAuthorizations}`, `saved_cases=${input.savedCases}`],
    },
    {
      id: MONOPOLY_RAIL.REGULATORY,
      title: "Regulatory aggregates",
      maturity: maturityFromScore(regulatoryScore),
      score: regulatoryScore,
      winCondition: "Supervisors/press cite snapshot API with verifiable counts",
      evidence: [`outcomes=${input.verifiedOutcomes}`, `saved=${input.savedCases}`],
    },
    {
      id: MONOPOLY_RAIL.DISTRIBUTION,
      title: "Agent + embed distribution",
      maturity: maturityFromScore(distributionScore),
      score: distributionScore,
      winCondition: "Other AIs and partners send measurable handoffs",
      evidence: [`attributed_signups=${input.attributedSignups}`, `saved=${input.savedCases}`],
    },
    {
      id: MONOPOLY_RAIL.CLOSED_LOOP,
      title: "Closed consumer loop",
      maturity: maturityFromScore(closedLoopScore),
      score: closedLoopScore,
      winCondition: "detect → act → prove → fee → share without callbacks",
      evidence: [`proofs=${input.proofsDocumented}`, `saved=${input.savedCases}`],
    },
  ];

  const infrastructureScore = clamp(
    rails.reduce((s, r) => s + r.score, 0) / rails.length,
  );

  return {
    assessedAt: new Date().toISOString(),
    flywheel,
    rails,
    infrastructureScore,
    barriers: BARRIER_CATALOG,
    disclaimer:
      "Infrastructure score is a logarithmic composite of real protocol counters. It is not revenue, user count, or market share.",
  };
}
