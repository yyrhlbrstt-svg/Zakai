/**
 * Honest deploy score from public readiness booleans — never inflates past env truth.
 */
export type ReadinessLayers = Record<string, boolean>;

export function readinessOperationalScore(layers: ReadinessLayers): number {
  const entries = Object.entries(layers);
  if (entries.length === 0) return 0;
  const on = entries.filter(([, v]) => v).length;
  return Math.round((on / entries.length) * 100);
}

/** Product code can be "complete" while ops layers (SMTP, PayPlus) are founder-owned. */
export function readinessTier(score: number): "blocked" | "degraded" | "operational" {
  if (score < 50) return "blocked";
  if (score < 85) return "degraded";
  return "operational";
}
