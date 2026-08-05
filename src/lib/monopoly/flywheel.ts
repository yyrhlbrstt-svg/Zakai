/**
 * Monopoly flywheel phases — honest gates, not vanity metrics.
 */

export const FLYWHEEL_PHASE = {
  PROTOCOL: "protocol",
  CONSUMER_MASS: "consumer_mass",
  INSTITUTIONAL: "institutional",
  COMMERCIAL: "commercial",
} as const;

export type FlywheelPhase = (typeof FLYWHEEL_PHASE)[keyof typeof FLYWHEEL_PHASE];

export interface FlywheelInputs {
  verifiedOutcomes: number;
  savedCases: number;
  activeAuthorizations: number;
  registryIssuersActive: number;
  delegatedIssuersActive: number;
  collectiveIntentSignals: number;
  marketsWithPacks: number;
}

export interface FlywheelAssessment {
  phase: FlywheelPhase;
  /** 0–100 composite for dashboards; logarithmic, never fabricated. */
  gravityIndex: number;
  legs: {
    learn: number;
    spread: number;
    mandate: number;
    institution: number;
  };
  nextGate: string;
}

function logScore(n: number, cap: number): number {
  if (n <= 0) return 0;
  const x = Math.log10(1 + n);
  const max = Math.log10(1 + cap);
  return Math.min(100, Math.round((x / max) * 100));
}

/**
 * Derive phase and per-leg scores from real counters only.
 */
export function assessFlywheel(input: FlywheelInputs): FlywheelAssessment {
  const learn = logScore(input.verifiedOutcomes, 100_000);
  const spread = logScore(input.savedCases, 50_000);
  const mandate = Math.min(
    100,
    logScore(input.activeAuthorizations, 500_000) * 0.6 +
      logScore(input.registryIssuersActive + input.delegatedIssuersActive, 50) * 0.4,
  );
  const institution = Math.min(
    100,
    logScore(input.collectiveIntentSignals, 1_000_000) * 0.5 +
      logScore(input.marketsWithPacks, 30) * 0.5,
  );

  const gravityIndex = Math.round(learn * 0.35 + spread * 0.25 + mandate * 0.25 + institution * 0.15);

  let phase: FlywheelPhase = FLYWHEEL_PHASE.PROTOCOL;
  let nextGate =
    "External interop probe green + packs on CDN + first institution inbound playbook published.";

  if (gravityIndex >= 15 && input.savedCases >= 10) {
    phase = FLYWHEEL_PHASE.CONSUMER_MASS;
    nextGate = "Documented savings volume + share loop + MIN_SAMPLE fairness for a real provider.";
  }
  if (gravityIndex >= 35 && input.delegatedIssuersActive >= 1 && input.activeAuthorizations >= 100) {
    phase = FLYWHEEL_PHASE.INSTITUTIONAL;
    nextGate = "Reference verifier on leaders wall + inbound pressure above public threshold.";
  }
  if (gravityIndex >= 55 && input.registryIssuersActive >= 2 && input.savedCases >= 1_000) {
    phase = FLYWHEEL_PHASE.COMMERCIAL;
    nextGate = "PSP + SMTP as default path — success fee on proof, not on promises.";
  }

  return {
    phase,
    gravityIndex,
    legs: { learn, spread, mandate, institution },
    nextGate,
  };
}
