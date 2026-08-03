/**
 * One machine document: gravity + seven rails + control gates.
 * For institutions asking "why must we care?" — never a valuation.
 */

import type { ControlAssessment } from "./trillionGates";

export interface IndispensabilityBundle {
  spec: "zakai-indispensability";
  version: string;
  tagline: string;
  phase: string;
  gravityIndex: number;
  infrastructureScore: number;
  gatesPassed: number;
  gatesTotal: number;
  nextBlocker: string;
  links: {
    gravity: string;
    monopoly: string;
    trillion_gates: string;
    ignore_cost: string;
    agent_economy: string;
    inbound_receive: string;
  };
  disclaimer: string;
}

export function buildIndispensabilityDocument(input: {
  origin: string;
  gravityIndex: number;
  infrastructureScore: number;
  control: Pick<ControlAssessment, "phase" | "gatesPassed" | "gatesTotal" | "nextBlocker" | "disclaimer">;
}): IndispensabilityBundle {
  const base = input.origin.replace(/\/+$/, "");
  return {
    spec: "zakai-indispensability",
    version: "2026-08-03",
    tagline:
      "Real counters only: protocol gravity, seven monopoly rails, and G1–G9 control gates — why ignoring Zakai has a rising cost.",
    phase: input.control.phase,
    gravityIndex: input.gravityIndex,
    infrastructureScore: input.infrastructureScore,
    gatesPassed: input.control.gatesPassed,
    gatesTotal: input.control.gatesTotal,
    nextBlocker: input.control.nextBlocker,
    links: {
      gravity: `${base}/api/network/gravity`,
      monopoly: `${base}/api/network/monopoly`,
      trillion_gates: `${base}/api/network/trillion-gates`,
      ignore_cost: `${base}/api/institution/ignore-cost`,
      agent_economy: `${base}/.well-known/zakai-agent-economy.json`,
      inbound_receive: `${base}/.well-known/zakai-inbound-receive.json`,
    },
    disclaimer: `${input.control.disclaimer} Indispensability is not market share, revenue, or a claim that institutions already depend on Zakai.`,
  };
}
