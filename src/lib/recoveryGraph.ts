import { prisma } from "@/lib/prisma";

/**
 * The recovery graph — Zakai's one genuinely defensible moat (a data network
 * effect). Every closed case teaches the system which counterparty, at what
 * starting price, yields what outcome: win rate, average documented saving,
 * and time-to-resolution. As usage grows this dataset — "what actually works
 * against whom" — compounds into an advantage a new entrant can't copy.
 *
 * This module is the first-class capture the strategy calls for. It reads only
 * data we already store (provider, amounts, status, timestamps, savings proof),
 * so it needs no schema change. Segmentation by vertical/jurisdiction is added
 * as those columns arrive.
 */

export interface CounterpartyRow {
  provider: string;
  /** Cases that reached a reply (SAVED or NO_SAVING). */
  settled: number;
  /** Of settled, how many produced a documented saving. */
  won: number;
  /** won / settled, 0..100, or null when no settled cases yet. */
  winRate: number | null;
  /** Average documented monthly saving across won cases, in agorot. */
  avgSavingAgorot: number;
  /** Average days from case creation to the saving being recorded. */
  avgDaysToResolve: number | null;
}

/** A minimal case shape the pure summarizer needs — easy to build in tests. */
export interface CaseLite {
  provider: string;
  status: string;
  createdAt: Date;
  savingMonthly: number | null; // from savingsProof, null if none
  recordedAt: Date | null; // when the saving was documented
}

/**
 * Pure aggregation — the tested core. Groups cases by counterparty and computes
 * the win rate, average saving and average resolution time per counterparty,
 * sorted by number of settled cases (most-learned-about first).
 */
export function summarizeCounterparties(cases: CaseLite[]): CounterpartyRow[] {
  const groups = new Map<string, CaseLite[]>();
  for (const c of cases) {
    const arr = groups.get(c.provider) ?? [];
    arr.push(c);
    groups.set(c.provider, arr);
  }

  const rows: CounterpartyRow[] = [];
  for (const [provider, list] of groups) {
    const settledCases = list.filter((c) => c.status === "SAVED" || c.status === "NO_SAVING");
    const wonCases = settledCases.filter((c) => c.status === "SAVED");
    const settled = settledCases.length;
    const won = wonCases.length;

    const savings = wonCases.map((c) => c.savingMonthly ?? 0).filter((n) => n > 0);
    const avgSavingAgorot =
      savings.length > 0 ? Math.round(savings.reduce((a, b) => a + b, 0) / savings.length) : 0;

    const durations = wonCases
      .filter((c) => c.recordedAt != null)
      .map((c) => (c.recordedAt!.getTime() - c.createdAt.getTime()) / 86_400_000)
      .filter((d) => d >= 0);
    const avgDaysToResolve =
      durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : null;

    rows.push({
      provider,
      settled,
      won,
      winRate: settled > 0 ? Math.round((won / settled) * 100) : null,
      avgSavingAgorot,
      avgDaysToResolve,
    });
  }

  return rows.sort((a, b) => b.settled - a.settled || b.won - a.won);
}

/** Load the cases and summarise. Returns [] on any DB error (page stays up). */
export async function computeRecoveryGraph(): Promise<CounterpartyRow[]> {
  try {
    const cases = await prisma.case.findMany({
      select: {
        provider: true,
        status: true,
        createdAt: true,
        savingsProof: { select: { savingMonthly: true, recordedAt: true } },
      },
    });
    const lite: CaseLite[] = cases.map((c) => ({
      provider: c.provider,
      status: c.status,
      createdAt: c.createdAt,
      savingMonthly: c.savingsProof?.savingMonthly ?? null,
      recordedAt: c.savingsProof?.recordedAt ?? null,
    }));
    return summarizeCounterparties(lite);
  } catch {
    return [];
  }
}
