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

import { PROVIDER_KEYS } from "@/lib/providers";
import { RULE_PACKS } from "@/lib/verticals/packs";

/**
 * Every provider slug a company page can meaningfully exist for — union of
 * the mobile registry and every full-service rule pack's named
 * counterparties, minus the generic "other" catch-all. This is static
 * configuration, not a data-driven claim about any one of them, so listing a
 * provider here carries none of MIN_SAMPLE's defamation risk — the risk is
 * only in *stats*, which stay gated wherever they're computed.
 */
export function listKnownProviders(): string[] {
  const slugs = new Set<string>(PROVIDER_KEYS);
  for (const pack of RULE_PACKS) {
    for (const c of pack.counterparties) slugs.add(c);
  }
  slugs.delete("other");
  return [...slugs].sort();
}

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

export interface VerticalCaseOutcome extends CaseOutcome {
  vertical: string;
}

export interface ProviderVerticalStat {
  vertical: string;
  cases: number;
  savedCases: number;
  savedRatePct: number;
  avgSavingAgorot: number;
}

/**
 * The same neutral-facts, sample-gated aggregate as `aggregateCompanyStats`,
 * cut one level finer: per vertical, for a single named provider. The gate
 * applies again at this finer grain, not just at the provider total — five
 * cases spread across three verticals does not clear the bar for any one of
 * them, because "100% success in parking" from a single case is exactly the
 * kind of thin-sample claim MIN_SAMPLE exists to block, regardless of how
 * solid the provider's overall total looks.
 */
export function aggregateProviderVerticalStats(
  provider: string,
  outcomes: readonly VerticalCaseOutcome[],
): ProviderVerticalStat[] {
  const byVertical = new Map<string, VerticalCaseOutcome[]>();
  for (const o of outcomes) {
    if (o.provider !== provider) continue;
    const arr = byVertical.get(o.vertical) ?? [];
    arr.push(o);
    byVertical.set(o.vertical, arr);
  }

  const stats: ProviderVerticalStat[] = [];
  for (const [vertical, arr] of byVertical) {
    if (arr.length < MIN_SAMPLE) continue;
    const savedList = arr.filter((o) => o.saved && o.savingAgorot > 0);
    const totalSaving = savedList.reduce((s, o) => s + o.savingAgorot, 0);
    stats.push({
      vertical,
      cases: arr.length,
      savedCases: savedList.length,
      savedRatePct: Math.round((savedList.length / arr.length) * 100),
      avgSavingAgorot: savedList.length > 0 ? Math.round(totalSaving / savedList.length) : 0,
    });
  }

  stats.sort((a, b) => b.cases - a.cases);
  return stats;
}

/** Case statuses that count as "currently pursuing this provider" — mirrors plans.ts's ACTIVE_CASE_STATUSES. */
const ACTIVE_PRESSURE_STATUSES = new Set(["ANALYZED", "APPROVED", "VERIFIED", "SENT"]);

export interface ActivePressureRow {
  provider: string;
  status: string;
}

export interface ActivePressureStat {
  provider: string;
  /** Open (not yet resolved) cases currently targeting this provider. */
  activeCases: number;
}

/**
 * "N people currently have an open case against this provider" — real-time
 * collective-pressure signal for a company's page, gated by the same
 * MIN_SAMPLE the rest of this file uses for the identical reason: a count of
 * one or two identifies individuals and carries defamation risk the same way
 * a thin-sample rating would. Below MIN_SAMPLE, a provider simply doesn't
 * appear here — never a fabricated small number.
 */
export function aggregateActivePressure(rows: readonly ActivePressureRow[]): ActivePressureStat[] {
  const byProvider = new Map<string, number>();
  for (const r of rows) {
    if (!ACTIVE_PRESSURE_STATUSES.has(r.status)) continue;
    byProvider.set(r.provider, (byProvider.get(r.provider) ?? 0) + 1);
  }

  const stats: ActivePressureStat[] = [];
  for (const [provider, activeCases] of byProvider) {
    if (activeCases < MIN_SAMPLE) continue;
    stats.push({ provider, activeCases });
  }

  stats.sort((a, b) => b.activeCases - a.activeCases);
  return stats;
}
