/**
 * Competitor barrier checklist — product + protocol moats (honest, not legal claims).
 */

export const MONOPOLY_BARRIER = {
  OUTCOME_GRAPH: "outcome_graph",
  ISSUER_NETWORK: "issuer_network",
  ZML_PACKS: "zml_packs",
  SWITCHING_HABIT: "switching_habit",
  REGULATORY_AGGREGATES: "regulatory_aggregates",
} as const;

export type MonopolyBarrier = (typeof MONOPOLY_BARRIER)[keyof typeof MONOPOLY_BARRIER];

export interface BarrierStatus {
  id: MonopolyBarrier;
  /** What a clone would need to replicate — time/cost, not magic. */
  requirement: string;
  /** Code paths that implement this barrier today. */
  anchors: string[];
}

export const BARRIER_CATALOG: BarrierStatus[] = [
  {
    id: MONOPOLY_BARRIER.OUTCOME_GRAPH,
    requirement: "Years of de-identified documented outcomes at MIN_SAMPLE per cohort.",
    anchors: ["prisma/schema.prisma:StrategyOutcome", "src/lib/fairnessScore.ts", "src/lib/oracle/store.ts"],
  },
  {
    id: MONOPOLY_BARRIER.ISSUER_NETWORK,
    requirement: "Multiple issuers on one JWKS registry + delegated pilots institutions accept.",
    anchors: ["src/lib/mandate/trustRegistry.ts", "prisma/schema.prisma:DelegatedIssuer"],
  },
  {
    id: MONOPOLY_BARRIER.ZML_PACKS,
    requirement: "Per-market rights as cited data, not blog posts.",
    anchors: ["src/lib/global/packs/", "src/lib/protocol/zml/"],
  },
  {
    id: MONOPOLY_BARRIER.SWITCHING_HABIT,
    requirement: "Every outbound artifact carries switching metadata institutions learn to parse.",
    anchors: ["src/lib/outreachSwitchingMeta.ts", "src/lib/protocol/switching.ts"],
  },
  {
    id: MONOPOLY_BARRIER.REGULATORY_AGGREGATES,
    requirement: "Supervisor-facing snapshots from real pipeline only.",
    anchors: ["src/lib/regulatory/snapshotSchema.ts", "src/lib/institutionInboundPressure.ts"],
  },
];
