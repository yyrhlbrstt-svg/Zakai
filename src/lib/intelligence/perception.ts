import type { PerceptionSignals } from "./types";

export interface PerceptionContext extends PerceptionSignals {
  sources: string[];
}

/** Merge client signals with server-safe defaults (market cookie etc.). */
export function buildPerceptionContext(
  signals: PerceptionSignals,
  opts?: { marketFallback?: string },
): PerceptionContext {
  const market = (signals.market || opts?.marketFallback || "IL").toUpperCase();
  const sources = ["client_signals"];
  if (signals.cellularMonthlyAgorot != null) sources.push("billing_aggregate");
  if (signals.provider) sources.push("provider_key");
  return { ...signals, market, sources };
}
