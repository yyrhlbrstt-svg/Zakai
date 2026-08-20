import "server-only";

import { prisma } from "@/lib/prisma";
import { ACTIVE_CASE_STATUSES } from "@/lib/plans";
import {
  computeStatuteConcentration,
  DEFAULT_MAX_STATUTE_SHARE,
} from "@/lib/rightsGraph/concentration";
import { findAdminUserIds } from "@/lib/ops/internalAdminGate";
import { pushToUser } from "@/lib/push";
import type { AutopilotJobResult } from "../findings";

/**
 * Concentration watcher — constraint 12 as a nightly fact.
 *
 * Counts active cases by vertical, maps them onto Rights Graph statutes, and
 * reports how concentrated the live book is on any single statute. Reports
 * always; alerts (finding severity + admin push) only on a real breach above
 * the minimum sample — an empty or tiny book is reported as exactly that.
 *
 * The watcher never rebalances anything: diversifying the Rights Graph is a
 * roadmap decision a human makes. It just makes sure nobody discovers the
 * book was one amendment away from stopping by reading about the amendment.
 */
export async function runConcentrationWatcher(): Promise<AutopilotJobResult> {
  const grouped = await prisma.case.groupBy({
    by: ["vertical"],
    where: { status: { in: [...ACTIVE_CASE_STATUSES] } },
    _count: { _all: true },
  });

  const envShare = Number(process.env.AUTOPILOT_MAX_STATUTE_SHARE);
  const maxShare =
    Number.isFinite(envShare) && envShare > 0 && envShare < 1
      ? envShare
      : DEFAULT_MAX_STATUTE_SHARE;

  const report = computeStatuteConcentration(
    grouped.map((g) => ({ vertical: g.vertical, count: g._count._all })),
    { maxShare },
  );

  const findings: AutopilotJobResult["findings"] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  for (const breach of report.breaches) {
    findings.push({
      kind: "statute_concentration_breach",
      // Past 80% the book is effectively single-statute — one legal event
      // from stopping — which is a different urgency than "over the line".
      severity: breach.share > 0.8 ? "critical" : "warning",
      message:
        `${pct(breach.share)} of mapped active cases ride ${breach.statuteName}, ` +
        `${breach.statuteSection} (${breach.count}/${report.totalMapped}; ceiling ${pct(report.maxShare)}). ` +
        "Diversify the Rights Graph before this statute becomes a single point of failure.",
      meta: { rightId: breach.rightId, share: breach.share, count: breach.count },
    });
  }

  if (report.belowSample && report.totalMapped > 0) {
    findings.push({
      kind: "below_alert_sample",
      severity: "note",
      message:
        `Only ${report.totalMapped} mapped active case(s) — concentration is reported, ` +
        `not alerted, below ${report.minCasesForAlert}.`,
    });
  }

  if (report.totalUnmapped > 0) {
    findings.push({
      kind: "unmapped_active_cases",
      severity: "note",
      message:
        `${report.totalUnmapped} active case(s) in verticals not yet mapped to a Rights Graph ` +
        "right — excluded from shares rather than folded in (folding them in would fake diversification).",
    });
  }

  // Alert on breach — best-effort, never lets notification failure fail the job.
  if (report.breaches.length > 0) {
    try {
      const adminIds = await findAdminUserIds();
      const top = report.breaches[0];
      await Promise.all(
        adminIds.map((userId) =>
          pushToUser(userId, {
            title: "Statute concentration breach",
            body: `${pct(top.share)} of the active book rides ${top.statuteSection} — ceiling ${pct(report.maxShare)}.`,
            url: "/founder#autopilot",
          }),
        ),
      );
    } catch {
      // The finding is the durable alert; the push is a courtesy.
    }
  }

  const top = report.shares[0];
  return {
    ok: report.breaches.length === 0,
    summary:
      report.totalMapped === 0
        ? `No mapped active cases (${report.totalUnmapped} unmapped). Nothing to concentrate yet — reported honestly as zero.`
        : `${report.totalMapped} mapped active case(s) across ${report.shares.length} statute(s); ` +
          `largest share ${pct(top.share)} (${top.statuteSection}); ceiling ${pct(report.maxShare)}; ` +
          `${report.breaches.length} breach(es); ${report.totalUnmapped} unmapped.`,
    findings,
  };
}
