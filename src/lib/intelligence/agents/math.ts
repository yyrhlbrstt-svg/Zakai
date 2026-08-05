import type { AgentNote, PerceptionSignals } from "../types";

/** Deterministic tenure / threshold checks — no LLM. */
export function runMathAgent(ctx: PerceptionSignals): AgentNote {
  const months = ctx.monthsOnPlan;
  if (months == null) {
    return {
      agent: "math",
      summary: "Tenure unknown — add monthsOnPlan for lock-in / cooling-off math.",
      confidence: "low",
    };
  }
  const pastCooling = months >= 12;
  const pastTwoYears = months >= 24;
  return {
    agent: "math",
    summary: pastTwoYears
      ? "24+ months on plan — many IL telecom retention rules treat you as long-tenure."
      : pastCooling
        ? "12+ months — past typical first-year lock; check pack for reduction rights."
        : "Under 12 months — verify contract lock before demanding reduction.",
    confidence: "medium",
    data: { months_on_plan: months, past_12: pastCooling, past_24: pastTwoYears },
  };
}
