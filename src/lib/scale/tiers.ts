/**
 * Deployment scale tiers — honest capacity stages (not marketing).
 */

export const SCALE_TIER = {
  SOLO: "solo",
  GROWTH: "growth",
  INSTITUTION: "institution",
  MULTI_MARKET: "multi_market",
  PLANETARY: "planetary",
} as const;

export type ScaleTier = (typeof SCALE_TIER)[keyof typeof SCALE_TIER];

export interface TierGate {
  tier: ScaleTier;
  /** Human-readable trigger — used in ops dashboards. */
  trigger: string;
  /** Required engineering moves before claiming this tier in runbooks. */
  moves: string[];
}

export const TIER_GATES: TierGate[] = [
  {
    tier: SCALE_TIER.SOLO,
    trigger: "<1k active cases, single region",
    moves: ["Vercel + Neon pooled URL", "Rate limits on auth", "Outbox in-process"],
  },
  {
    tier: SCALE_TIER.GROWTH,
    trigger: "Fee volume + outbox backlog risk",
    moves: ["Dedicated outbox worker", "Idempotency on case mutations", "Read replica for aggregates"],
  },
  {
    tier: SCALE_TIER.INSTITUTION,
    trigger: "Banks verify JWKS in production",
    moves: ["Key rotation runbook", "SLA on mandate verify", "SOC2-ready audit logs"],
  },
  {
    tier: SCALE_TIER.MULTI_MARKET,
    trigger: "Pack demand outside IL",
    moves: ["ZML packs on CDN", "Edge locale config", "No country if-soup in app code"],
  },
  {
    tier: SCALE_TIER.PLANETARY,
    trigger: "Class A endpoints at CDN; Class C at millions RPS",
    moves: [
      "Shard StrategyOutcome by partition key",
      "Global JWKS + gravity at edge",
      "Queue plane for all outbound",
    ],
  },
];
