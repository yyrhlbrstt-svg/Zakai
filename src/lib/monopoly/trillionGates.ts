/**
 * Honest gates from “protocol skeleton” → “hard to ignore globally”.
 * Never claims current valuation. Used by GET /api/network/trillion-gates.
 */

export const CONTROL_PHASE = {
  SKELETON: "skeleton",
  LOCAL_GRAVITY: "local_gravity",
  REGIONAL_DEFAULT: "regional_default",
  GLOBAL_RAIL: "global_rail",
} as const;

export type ControlPhase = (typeof CONTROL_PHASE)[keyof typeof CONTROL_PHASE];

export interface GateDefinition {
  id: string;
  title: string;
  /** What must be true in the real world (not code alone). */
  requirement: string;
  /** How we measure in-repo / APIs. */
  measure: string;
}

/** Ordered — each unlocks the next claim of market control. */
export const TRILLION_GATES: readonly GateDefinition[] = [
  {
    id: "G1_interop_green",
    title: "External interop probe green",
    requirement: "A third party can verify the protocol without talking to us.",
    measure: "npm run verify:interop-external on production",
  },
  {
    id: "G2_packs_cdn",
    title: "ZML packs on public CDN",
    requirement: "Developers load rights packs as default data, not our UI.",
    measure: "verify:packs-cdn + ZML_PACKS_CDN live",
  },
  {
    id: "G3_first_verifier",
    title: "First reference verifier listed",
    requirement: "An institution publishes that it verifies Mandate inbound.",
    measure: "ReferenceVerifier row + leaders wall non-empty",
  },
  {
    id: "G4_min_sample_fairness",
    title: "Fairness score with real MIN_SAMPLE",
    requirement: "At least one provider has a public score from real outcomes.",
    measure: "GET /api/fairness/scores providers.length ≥ 1",
  },
  {
    id: "G5_second_issuer",
    title: "Second active issuer on trust registry",
    requirement: "We are not the only Mandate issuer — network begins.",
    measure: "registryIssuersActive + delegatedIssuersActive ≥ 2",
  },
  {
    id: "G6_inbound_volume",
    title: "Inbound pressure above public threshold",
    requirement: "Ignoring Mandate mail has operational cost for top providers.",
    measure: "disclosed inbound-pressure institutions ≥ 3 with dispatchedCases ≥ 50",
  },
  {
    id: "G7_cross_market",
    title: "Two markets with cited depth + consumer volume",
    requirement: "Not an Israel-only novelty app.",
    measure: "marketsWithCitedRights ≥ 2 AND savedCases ≥ 100 with multi-market outcomes",
  },
  {
    id: "G8_agent_distribution",
    title: "Other AIs send measurable handoffs",
    requirement: "ChatGPT/Claude/etc. are a channel, not a competitor UI.",
    measure: "attributedSignups (partnerRef/agent) ≥ 500",
  },
  {
    id: "G9_closed_loop_fees",
    title: "Commercial phase D live",
    requirement: "Success fees settle on proof at scale — not mock PSP.",
    measure: "paymentsFullyLive + documented fee volume (ops, not public vanity)",
  },
] as const;

export interface GateEvaluationInput {
  interopExternalGreen: boolean;
  packsCdnLive: boolean;
  referenceVerifiers: number;
  fairnessProvidersScored: number;
  issuersTotal: number;
  inboundInstitutionsOverThreshold: number;
  marketsWithCitedRights: number;
  multiMarketOutcomes: boolean;
  savedCases: number;
  attributedSignups: number;
  paymentsLive: boolean;
}

export interface GateStatus {
  id: string;
  title: string;
  requirement: string;
  passed: boolean;
  evidence: string;
}

export interface ControlAssessment {
  phase: ControlPhase;
  gatesPassed: number;
  gatesTotal: number;
  gates: GateStatus[];
  /** Plain language — never a dollar figure. */
  nextBlocker: string;
  disclaimer: string;
}

function phaseFromPassed(n: number): ControlPhase {
  if (n >= 8) return CONTROL_PHASE.GLOBAL_RAIL;
  if (n >= 5) return CONTROL_PHASE.REGIONAL_DEFAULT;
  if (n >= 3) return CONTROL_PHASE.LOCAL_GRAVITY;
  return CONTROL_PHASE.SKELETON;
}

export function evaluateTrillionGates(input: GateEvaluationInput): ControlAssessment {
  const gates: GateStatus[] = [
    {
      id: "G1_interop_green",
      title: TRILLION_GATES[0]!.title,
      requirement: TRILLION_GATES[0]!.requirement,
      passed: input.interopExternalGreen,
      evidence: `interop_external=${input.interopExternalGreen}`,
    },
    {
      id: "G2_packs_cdn",
      title: TRILLION_GATES[1]!.title,
      requirement: TRILLION_GATES[1]!.requirement,
      passed: input.packsCdnLive,
      evidence: `packs_cdn=${input.packsCdnLive}`,
    },
    {
      id: "G3_first_verifier",
      title: TRILLION_GATES[2]!.title,
      requirement: TRILLION_GATES[2]!.requirement,
      passed: input.referenceVerifiers >= 1,
      evidence: `reference_verifiers=${input.referenceVerifiers}`,
    },
    {
      id: "G4_min_sample_fairness",
      title: TRILLION_GATES[3]!.title,
      requirement: TRILLION_GATES[3]!.requirement,
      passed: input.fairnessProvidersScored >= 1,
      evidence: `fairness_providers=${input.fairnessProvidersScored}`,
    },
    {
      id: "G5_second_issuer",
      title: TRILLION_GATES[4]!.title,
      requirement: TRILLION_GATES[4]!.requirement,
      passed: input.issuersTotal >= 2,
      evidence: `issuers_total=${input.issuersTotal}`,
    },
    {
      id: "G6_inbound_volume",
      title: TRILLION_GATES[5]!.title,
      requirement: TRILLION_GATES[5]!.requirement,
      passed: input.inboundInstitutionsOverThreshold >= 3,
      evidence: `inbound_over_threshold=${input.inboundInstitutionsOverThreshold}`,
    },
    {
      id: "G7_cross_market",
      title: TRILLION_GATES[6]!.title,
      requirement: TRILLION_GATES[6]!.requirement,
      passed:
        input.marketsWithCitedRights >= 2 &&
        input.savedCases >= 100 &&
        input.multiMarketOutcomes,
      evidence: `cited_markets=${input.marketsWithCitedRights};saved=${input.savedCases};multi=${input.multiMarketOutcomes}`,
    },
    {
      id: "G8_agent_distribution",
      title: TRILLION_GATES[7]!.title,
      requirement: TRILLION_GATES[7]!.requirement,
      passed: input.attributedSignups >= 500,
      evidence: `attributed_signups=${input.attributedSignups}`,
    },
    {
      id: "G9_closed_loop_fees",
      title: TRILLION_GATES[8]!.title,
      requirement: TRILLION_GATES[8]!.requirement,
      passed: input.paymentsLive && input.savedCases >= 1000,
      evidence: `payments_live=${input.paymentsLive};saved=${input.savedCases}`,
    },
  ];

  const gatesPassed = gates.filter((g) => g.passed).length;
  const firstFail = gates.find((g) => !g.passed);

  return {
    phase: phaseFromPassed(gatesPassed),
    gatesPassed,
    gatesTotal: gates.length,
    gates,
    nextBlocker: firstFail
      ? `${firstFail.id}: ${firstFail.requirement}`
      : "All measured gates passed — sustain volume and multi-issuer depth.",
    disclaimer:
      "Gates measure protocol gravity and adoption readiness. They are not a valuation, revenue forecast, or claim that Zakai currently 'controls' any market.",
  };
}
