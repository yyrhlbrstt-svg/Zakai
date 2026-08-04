import "server-only";

import type { AgentNote, PerceptionSignals } from "../types";
import { predict } from "@/lib/oracle/store";

export async function runRiskAgent(ctx: PerceptionSignals): Promise<AgentNote> {
  const vertical = ctx.cellularMonthlyAgorot != null ? "telecom" : "consumer";
  const counterparty = ctx.provider ?? "unknown";
  const prediction = await predict({
    market: ctx.market,
    vertical,
    counterparty,
  });

  const level =
    prediction.confident && prediction.paidProbability >= 0.55
      ? "low"
      : prediction.confident && prediction.paidProbability >= 0.35
        ? "medium"
        : "high";

  return {
    agent: "risk",
    summary: prediction.confident
      ? `Oracle: ~${(prediction.paidProbability * 100).toFixed(0)}% documented pay probability (${prediction.evidence.trials} outcomes).`
      : "Oracle: not enough de-identified outcomes — treat as medium risk; user must approve send.",
    confidence: prediction.confident ? "high" : "low",
    data: {
      probability_paid: prediction.paidProbability,
      sample_size: prediction.evidence.trials,
      risk_level: level,
    },
  };
}
