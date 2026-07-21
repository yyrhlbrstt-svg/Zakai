/**
 * The seed of "Zakai Score" — aggregate, factual outcomes per provider, built
 * from real cases. As cases accumulate this becomes a data moat: which
 * providers actually reduce bills, and by how much. Both sides eventually need
 * it — consumers to choose, providers to monitor.
 *
 * LEGAL SAFEGUARD (defamation / לשון הרע): a rating built on thin data can
 * unfairly harm a named company. So we only ever surface a provider once it
 * clears MIN_SAMPLE documented cases, and we report neutral FACTS ("across N
 * documented cases the average saving was X") — never a subjective judgment.
 * This function is pure and tested; the gate lives here so no caller can skip it.
 */
export const MIN_SAMPLE = 5;

export interface CaseOutcome {
  provider: string;
  /** A documented saving was recorded for this case. */
  saved: boolean;
  /** Monthly saving in agorot (0 when none). */
  savingAgorot: number;
}

export interface CompanyStat {
  provider: string;
  cases: number; // documented cases in the sample
  savedCases: number; // how many reached a documented saving
  savedRatePct: number; // savedCases / cases, 0..100
  avgSavingAgorot: number; // mean saving across cases that saved
}

/**
 * Aggregate outcomes per provider, returning only providers that clear the
 * sample gate, sorted by average saving (most impactful first). Neutral facts.
 */
export function aggregateCompanyStats(outcomes: CaseOutcome[]): CompanyStat[] {
  const byProvider = new Map<string, CaseOutcome[]>();
  for (const o of outcomes) {
    const arr = byProvider.get(o.provider) ?? [];
    arr.push(o);
    byProvider.set(o.provider, arr);
  }

  const stats: CompanyStat[] = [];
  for (const [provider, arr] of byProvider) {
    if (arr.length < MIN_SAMPLE) continue; // the legal + statistical gate
    const savedList = arr.filter((o) => o.saved && o.savingAgorot > 0);
    const totalSaving = savedList.reduce((s, o) => s + o.savingAgorot, 0);
    stats.push({
      provider,
      cases: arr.length,
      savedCases: savedList.length,
      savedRatePct: Math.round((savedList.length / arr.length) * 100),
      avgSavingAgorot: savedList.length > 0 ? Math.round(totalSaving / savedList.length) : 0,
    });
  }

  stats.sort((a, b) => b.avgSavingAgorot - a.avgSavingAgorot);
  return stats;
}
