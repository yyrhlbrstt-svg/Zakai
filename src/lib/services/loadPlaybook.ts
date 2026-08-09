import "server-only";
import { prismaRead } from "@/lib/prismaRead";
import { buildPlaybook, type PlaybookResult } from "@/lib/counterpartyPlaybook";
import { MIN_SAMPLE } from "@/lib/companyScore";

/**
 * Feed the playbook from the de-identified outcome table.
 *
 * Documented outcomes only. A self-report is somebody's recollection, and this
 * result is handed to a third-party agent as guidance about a named company —
 * the weakest possible evidence going to the widest possible audience is the
 * one combination worth refusing outright.
 *
 * `StrategyOutcome` carries no User or Case foreign key by rule, so nothing
 * here can leak a claimant even by accident.
 */
export async function loadPlaybook(
  counterparty: string,
  vertical: string | null = null,
): Promise<PlaybookResult> {
  const key = counterparty.trim().toLowerCase();
  if (!key) {
    return { ok: false, reason: "not_enough_evidence", sampleSize: 0, minSample: MIN_SAMPLE };
  }

  try {
    const rows = await prismaRead.strategyOutcome.findMany({
      where: {
        counterparty: key,
        selfReported: false,
        ...(vertical ? { vertical } : {}),
      },
      select: {
        counterparty: true,
        vertical: true,
        variantId: true,
        paid: true,
        recoveredMinor: true,
        days: true,
      },
    });
    return buildPlaybook(key, rows, vertical);
  } catch {
    // A database that cannot be reached is not evidence of a company with no
    // record. Saying "not enough evidence" is true either way.
    return { ok: false, reason: "not_enough_evidence", sampleSize: 0, minSample: MIN_SAMPLE };
  }
}
