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
  // Telecom — phase 2 after banks (NORTH_STAR_100)
  cellcom: ["cellcom"],
  partner: ["partner"],
  pelephone: ["pelephone"],
  hotspot: ["hot", "hotspot", "hot-mobile"],
  "012mobile": ["012", "012mobile"],
  // Electricity
  iec: ["iec", "חברת החשמל", "electricity"],
  pazgas: ["pazgas"],
  amisor: ["amisor"],
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
