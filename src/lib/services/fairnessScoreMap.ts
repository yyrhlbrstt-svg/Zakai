import "server-only";

import { loadFairnessScores } from "@/lib/services/fairnessScores";
import type { FairnessProviderScore } from "@/lib/fairnessScore";

export async function fairnessScoreMap(market = "IL"): Promise<Map<string, FairnessProviderScore>> {
  const scores = await loadFairnessScores(market);
  return new Map(scores.map((s) => [s.provider, s]));
}
