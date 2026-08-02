import { rankPriorityActions } from "@/lib/priority";
import { getPriorityCatalogBoosts } from "@/lib/services/priorityBoosts";

export type LeakEntry = {
  href: string;
  he: string;
  en: string;
  subHe: string;
  subEn: string;
  rank: number;
};

/**
 * Sort leak map doors by the same engine as Money OS / dashboard priority,
 * while preserving static rank as tie-breaker.
 */
export async function rankLeakEntries<T extends LeakEntry>(entries: readonly T[]): Promise<T[]> {
  const boosts = await getPriorityCatalogBoosts("IL");
  const ordered = rankPriorityActions(80, boosts);
  const hrefScore = new Map<string, number>();
  ordered.forEach((a, i) => hrefScore.set(a.href, ordered.length - i));

  return [...entries].sort((a, b) => {
    const sa = hrefScore.get(a.href) ?? 0;
    const sb = hrefScore.get(b.href) ?? 0;
    if (sb !== sa) return sb - sa;
    return a.rank - b.rank;
  });
}

/** Top hrefs for highlighting «starts here» on the leaks grid. */
export function topLeakHrefs(ranked: readonly LeakEntry[], n = 3): Set<string> {
  return new Set(ranked.slice(0, n).map((l) => l.href));
}
