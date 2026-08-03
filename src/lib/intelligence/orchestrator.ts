import "server-only";

import type { IntelligenceBrief, PerceptionSignals } from "./types";
import { buildPerceptionContext } from "./perception";
import { getCohortInsight } from "./cohort";
import { runLawAgent } from "./agents/law";
import { runMathAgent } from "./agents/math";
import { runNegotiationAgent } from "./agents/negotiation";
import { runTimingAgent } from "./agents/timing";
import { runRiskAgent } from "./agents/risk";

export async function buildIntelligenceBrief(
  signals: PerceptionSignals,
  opts?: { marketFallback?: string },
): Promise<IntelligenceBrief> {
  const ctx = buildPerceptionContext(signals, opts);
  const vertical = ctx.cellularMonthlyAgorot != null ? "telecom" : "consumer";
  const counterparty = ctx.provider ?? "unknown";

  const [negotiation, risk] = await Promise.all([
    runNegotiationAgent(ctx),
    runRiskAgent(ctx),
  ]);

  const agents = [runLawAgent(ctx), runMathAgent(ctx), negotiation, runTimingAgent(), risk];

  const actions: IntelligenceBrief["recommended_actions"] = [];
  if (ctx.cellularMonthlyAgorot != null || ctx.provider) {
    actions.push({
      href: "/check",
      why: "Telecom negotiation agent with Mandate — written path, not phone callback.",
      estimated_confidence: risk.data?.probability_paid as number | undefined,
    });
  }
  actions.push({
    href: "/rights",
    why: "Rights pack check from your profile signals (client-side eligible list).",
  });
  actions.push({
    href: "/money",
    why: "Scan recurring charges — perception stays in browser until you act.",
  });

  const cohort = await getCohortInsight(ctx.market, vertical, counterparty);

  return {
    spec: "zakai-intelligence-brief",
    version: "2026-08-03",
    market: ctx.market,
    layers: {
      perception: {
        status: "active",
        notes: [`Sources: ${ctx.sources.join(", ")}`, "No raw bill images required on server."],
      },
      cognition: {
        status: "active",
        notes: ["Specialist agents (law/math/negotiation/timing/risk) — not one monolithic LLM."],
      },
      action: {
        status: "active",
        notes: ["Recommendations route to in-app agents; user approves before send."],
      },
      reflection: {
        status: "active",
        notes: ["Learning via StrategyOutcome + /api/cron/evolve + autopilot outcome-learner."],
      },
    },
    agents,
    recommended_actions: actions,
    cohort: cohort
      ? {
          disclaimer: "Anonymous outcomes with same market/vertical/counterparty — not identity.",
          similar_outcomes: cohort.similar_outcomes,
          win_rate: cohort.win_rate,
        }
      : undefined,
    disclaimer:
      "Brief is guidance from packs and de-identified outcomes — not legal advice or a promise of recovery.",
  };
}

export function buildIntelligenceManifest(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: "zakai-intelligence",
    version: "2026-08-03",
    thesis: "Context beats model size — ZML + outcomes + your signals, orchestrated by small agents.",
    layers: ["perception", "cognition", "action", "reflection"],
    agents: ["law", "math", "negotiation", "timing", "risk", "meta"],
    endpoints: {
      brief: `${base}/api/intelligence/brief`,
      oracle_predict: `${base}/api/oracle/predict`,
      outcomes: `${base}/api/outcome`,
      evolve: `${base}/api/cron/evolve`,
      autopilot: `${base}/.well-known/zakai-autopilot.json`,
    },
    rag: {
      status: "zml_catalog",
      note: "Rights retrieval via GET /api/rights/catalog and in-app evaluatePack — vector DB optional future.",
    },
    docs: "docs/INTELLIGENCE_ARCHITECTURE.md",
  };
}
