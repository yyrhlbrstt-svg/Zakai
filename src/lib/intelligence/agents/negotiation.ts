import type { AgentNote, PerceptionSignals } from "../types";
import { aggregateFairnessScores } from "@/lib/fairnessScore";
import { prisma } from "@/lib/prisma";

export async function runNegotiationAgent(ctx: PerceptionSignals): Promise<AgentNote> {
  const provider = ctx.provider?.toLowerCase();
  if (!provider) {
    return {
      agent: "negotiation",
      summary: "No provider key — default to formal written tone; add provider for pattern hints.",
      confidence: "low",
    };
  }

  const since = new Date(Date.now() - 180 * 86_400_000);
  const rows = await prisma.strategyOutcome.findMany({
    where: {
      market: ctx.market,
      counterparty: provider,
      createdAt: { gte: since },
      selfReported: false,
    },
    select: { paid: true },
    take: 2000,
  });

  const scores = aggregateFairnessScores(
    rows.map((r) => ({ counterparty: provider, won: r.paid })),
  );
  const score = scores[0];

  if (!score) {
    return {
      agent: "negotiation",
      summary: `Insufficient documented outcomes for ${provider} — use formal_assertive tone and cite statute in writing.`,
      confidence: "low",
      data: { provider },
    };
  }

  const tone = score.fairnessScore >= 60 ? "formal_collaborative" : "formal_assertive";
  return {
    agent: "negotiation",
    summary: `Documented win rate ${score.fairnessScore}% (${score.observations} cases) → prefer ${tone} tone.`,
    confidence: score.observations >= 10 ? "high" : "medium",
    data: { provider, fairness_score: score.fairnessScore, tone },
  };
}
