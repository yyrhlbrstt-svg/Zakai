/**
 * Maps Mandate institution ids (aud slugs) to Case.provider keys used in the
 * consumer loop. Hypothesis-only aliases — not a claim that the bank signed up.
 */
import { MIN_SAMPLE } from "@/lib/companyScore";

export interface ProviderCaseRow {
  provider: string;
  status: string;
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
  "bank-hapoalim": ["hapoalim"],
  "bank-leumi": ["leumi"],
  "bank-discount": ["discount"],
  "bank-mizrahi": ["mizrahi"],
  "bank-fibi": ["fibi"],
  "one-zero": ["onezero"],
};

const OUTBOUND_STATUSES = new Set(["SENT", "SAVED", "NO_SAVING"]);

function providerToInstitution(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [institutionId, keys] of Object.entries(INSTITUTION_PROVIDER_MAP)) {
    for (const k of keys) m.set(k.toLowerCase(), institutionId);
  }
  return m;
}

const REVERSE = providerToInstitution();

/**
 * Aggregate documented consumer outbound volume per institution slug.
 * Pure — safe to test without DB.
 */
export function aggregateInboundPressure(rows: readonly ProviderCaseRow[]): InboundPressureStat[] {
  const byInst = new Map<string, { dispatched: number; saved: number }>();

  for (const row of rows) {
    if (!OUTBOUND_STATUSES.has(row.status)) continue;
    const institutionId = REVERSE.get(row.provider.trim().toLowerCase());
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
