/**
 * Maps Mandate institution ids (aud slugs) to Case.provider keys used in the
 * consumer loop. Hypothesis-only aliases — not a claim that the bank signed up.
 */
import { MIN_SAMPLE } from "@/lib/companyScore";

export interface ProviderCaseRow {
  provider: string;
  status: string;
  mandateAudience?: string | null;
}

export interface InboundPressureStat {
  institutionId: string;
  /** Cases that reached outbound dispatch to a mapped counterparty. */
  dispatchedCases: number;
  savedCases: number;
  /** True when dispatchedCases >= MIN_SAMPLE (same defamation/stat gate as company score). */
  disclosed: boolean;
}

/** institution aud slug → case.provider keys (normalized lowercase). */
export const INSTITUTION_PROVIDER_MAP: Readonly<Record<string, readonly string[]>> = {
  // Banks
  "bank-hapoalim": ["hapoalim"],
  "bank-leumi": ["leumi"],
  "bank-discount": ["discount"],
  "bank-mizrahi": ["mizrahi"],
  "bank-fibi": ["fibi"],
  "one-zero": ["onezero"],
  // Telecom — phase 2 after banks (NORTH_STAR_100) + ISP aliases
  cellcom: ["cellcom"],
  partner: ["partner"],
  pelephone: ["pelephone"],
  hotspot: ["hot", "hotspot", "hot-mobile"],
  "012mobile": ["012", "012mobile"],
  bezeq: ["bezeq"],
  yes: ["yes"],
  // Electricity / gas — one institution id per provider key (no reverse-map overwrite)
  iec: ["iec", "חברת החשמל", "electricity"],
  pazgas: ["pazgas"],
  amisor: ["amisor"],
  "am-isragas": ["am-isragas", "isragas"],

};

const OUTBOUND_STATUSES = new Set(["SENT", "SAVED", "NO_SAVING"]);

export function isOutboundCaseStatus(status: string): boolean {
  return OUTBOUND_STATUSES.has(status);
}

export function providerKeysForInstitution(institutionId: string): readonly string[] {
  return INSTITUTION_PROVIDER_MAP[institutionId] ?? [];
}

function providerToInstitution(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [institutionId, keys] of Object.entries(INSTITUTION_PROVIDER_MAP)) {
    for (const k of keys) m.set(k.toLowerCase(), institutionId);
  }
  return m;
}

const REVERSE = providerToInstitution();

/** Prefer stored mandate `aud`; fall back to provider alias map. */
export function institutionIdFromOutboundRow(row: ProviderCaseRow): string | null {
  if (!isOutboundCaseStatus(row.status)) return null;
  const aud = row.mandateAudience?.trim().toLowerCase();
  if (aud && aud in INSTITUTION_PROVIDER_MAP) return aud;
  return REVERSE.get(row.provider.trim().toLowerCase()) ?? null;
}

/**
 * Aggregate documented consumer outbound volume per institution slug.
 * Pure — safe to test without DB.
 */
export function aggregateInboundPressure(rows: readonly ProviderCaseRow[]): InboundPressureStat[] {
  const byInst = new Map<string, { dispatched: number; saved: number }>();

  for (const row of rows) {
    const institutionId = institutionIdFromOutboundRow(row);
    if (!institutionId) continue;
    const cur = byInst.get(institutionId) ?? { dispatched: 0, saved: 0 };
    cur.dispatched += 1;
    if (row.status === "SAVED") cur.saved += 1;
    byInst.set(institutionId, cur);
  }

  const stats: InboundPressureStat[] = [];
  for (const [institutionId, { dispatched, saved }] of byInst) {
    stats.push({
      institutionId,
      dispatchedCases: dispatched,
      savedCases: saved,
      disclosed: dispatched >= MIN_SAMPLE,
    });
  }

  stats.sort((a, b) => b.dispatchedCases - a.dispatchedCases);
  return stats;
}

export function disclosedInboundPressure(stats: readonly InboundPressureStat[]): InboundPressureStat[] {
  return stats.filter((s) => s.disclosed);
}

const CASE_PRESSURE_SELECT = {
  provider: true,
  status: true,
  authorization: { select: { mandateAudience: true } },
} as const;

export type CasePressureDbRow = {
  provider: string;
  status: string;
  authorization: { mandateAudience: string | null } | null;
};

export function pressureRowsFromCases(cases: readonly CasePressureDbRow[]): ProviderCaseRow[] {
  return cases.map((c) => ({
    provider: c.provider,
    status: c.status,
    mandateAudience: c.authorization?.mandateAudience ?? null,
  }));
}

export { CASE_PRESSURE_SELECT };

export interface InboundPressureDatedRow extends ProviderCaseRow {
  createdAt: Date;
}

export interface InboundPressureTrend {
  institutionId: string;
  /** Dispatched cases in the most recent TREND_WINDOW_DAYS. */
  recentWindowCases: number;
  /** Dispatched cases in the TREND_WINDOW_DAYS immediately before that. */
  priorWindowCases: number;
  /** (recent - prior) / prior, as a percentage. Null when priorWindowCases is 0 — no ratio is honest to report against zero. */
  changePct: number | null;
}

/** Both windows compared, in days. 30 is short enough to be an early-warning signal, long enough not to be noise. */
export const TREND_WINDOW_DAYS = 30;

/**
 * The same disclosed volume the free /api/institution/inbound-pressure
 * publishes as one current snapshot, split into two consecutive windows so a
 * paid consumer sees direction, not just level — a regulator's own risk team
 * cares whether inbound pressure against an institution is accelerating, not
 * only how much there is today. Deliberately simple (a two-window delta, not
 * a fitted trendline): claiming more statistical sophistication than the
 * sample supports is the same honesty failure the Oracle's `confident` flag
 * and the evidence API's MIN_SAMPLE gate both exist to prevent.
 */
export function aggregateInboundPressureTrend(
  rows: readonly InboundPressureDatedRow[],
  now: Date = new Date(),
): InboundPressureTrend[] {
  const windowMs = TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentStart = now.getTime() - windowMs;
  const priorStart = recentStart - windowMs;

  const byInst = new Map<string, { recent: number; prior: number; total: number }>();
  for (const row of rows) {
    const institutionId = institutionIdFromOutboundRow(row);
    if (!institutionId) continue;
    const t = row.createdAt.getTime();
    if (t < priorStart || t > now.getTime()) continue;

    const cur = byInst.get(institutionId) ?? { recent: 0, prior: 0, total: 0 };
    cur.total += 1;
    if (t >= recentStart) cur.recent += 1;
    else cur.prior += 1;
    byInst.set(institutionId, cur);
  }

  const trends: InboundPressureTrend[] = [];
  for (const [institutionId, { recent, prior, total }] of byInst) {
    // Same MIN_SAMPLE defamation/statistics gate as every other disclosed
    // aggregate — a thin two-window sample is exactly the kind of thing that
    // gate exists to keep off a report someone else relies on.
    if (total < MIN_SAMPLE) continue;
    trends.push({
      institutionId,
      recentWindowCases: recent,
      priorWindowCases: prior,
      changePct: prior === 0 ? null : Math.round(((recent - prior) / prior) * 100),
    });
  }

  trends.sort((a, b) => b.recentWindowCases - a.recentWindowCases);
  return trends;
}
