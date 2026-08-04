/**
 * Four-layer intelligence architecture — types only (no PII graph on server).
 */

export type IntelligenceLayer = "perception" | "cognition" | "action" | "reflection";

export type AgentId = "law" | "math" | "negotiation" | "timing" | "risk" | "meta";

export interface PerceptionSignals {
  /** ISO market */
  market: string;
  /** Optional client-side aggregates — never raw bill images on server */
  cellularMonthlyAgorot?: number;
  provider?: string;
  monthsOnPlan?: number;
  ageBand?: "18_24" | "25_44" | "45_66" | "67_plus";
  children?: number;
  employment?: string;
}

export interface AgentNote {
  agent: AgentId;
  summary: string;
  confidence: "low" | "medium" | "high";
  data?: Record<string, unknown>;
}

export interface IntelligenceBrief {
  spec: "zakai-intelligence-brief";
  version: "2026-08-03";
  market: string;
  layers: Record<IntelligenceLayer, { status: "active" | "degraded"; notes: string[] }>;
  agents: AgentNote[];
  recommended_actions: Array<{
    href: string;
    why: string;
    estimated_confidence?: number;
  }>;
  cohort?: {
    disclaimer: string;
    similar_outcomes: number;
    win_rate: number | null;
  };
  disclaimer: string;
}
