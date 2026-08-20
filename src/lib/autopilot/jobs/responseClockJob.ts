import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computeResponseClock,
  ESCALATION_RUNG_HE,
} from "@/lib/rightsGraph/responseClock";
import type { AutopilotJobResult } from "../findings";

/**
 * Response clock — Phase 2's deadline clocks as a nightly fact.
 *
 * For every SENT case whose vertical invokes a graphed right, compute where
 * the response window on its last dispatched demand stands. Cases whose
 * window has closed are the ones a solo operation silently loses: nobody is
 * paid to notice that day 15 arrived, so this job is.
 *
 * Reports only. Every escalation artifact (follow-up, regulator complaint,
 * small-claims draft) still requires the person's explicit action on their
 * own case — the clock names what is due, it never sends anything.
 */
export async function runResponseClock(): Promise<AutopilotJobResult> {
  const sentCases = await prisma.case.findMany({
    where: { status: "SENT" },
    select: { id: true, vertical: true },
  });

  const findings: AutopilotJobResult["findings"] = [];
  if (sentCases.length === 0) {
    return {
      ok: true,
      summary: "No SENT cases — no response windows to track. Reported honestly as zero.",
      findings,
    };
  }

  const dispatched = await prisma.outbox.groupBy({
    by: ["caseId"],
    where: {
      caseId: { in: sentCases.map((c) => c.id) },
      channel: "EMAIL",
      status: "SENT",
      sentAt: { not: null },
    },
    _max: { sentAt: true },
    _count: { _all: true },
  });
  const byCase = new Map(dispatched.map((d) => [d.caseId, d]));

  let unmapped = 0;
  let neverDispatched = 0;
  let insideWindow = 0;
  const expiredByRung = new Map<string, number>();

  for (const kase of sentCases) {
    const trail = byCase.get(kase.id);
    if (!trail || !trail._max.sentAt) {
      // Status says SENT but no EMAIL ever left — a real state under mock
      // SMTP. Counted separately: a clock on a demand that never went out
      // would be a clock on nothing.
      neverDispatched += 1;
      continue;
    }
    const clock = computeResponseClock({
      vertical: kase.vertical,
      lastDemandSentAt: trail._max.sentAt,
      demandsSent: trail._count._all,
    });
    if (!clock) {
      unmapped += 1;
      continue;
    }
    if (!clock.expired) {
      insideWindow += 1;
      continue;
    }
    expiredByRung.set(clock.nextRung, (expiredByRung.get(clock.nextRung) ?? 0) + 1);
  }

  const totalExpired = [...expiredByRung.values()].reduce((a, b) => a + b, 0);

  for (const [rung, count] of [...expiredByRung.entries()].sort((a, b) => b[1] - a[1])) {
    findings.push({
      kind: "response_window_expired",
      severity: "warning",
      message:
        `${count} SENT case(s) past their response deadline with "${ESCALATION_RUNG_HE[rung] ?? rung}" ` +
        "as the next rung. The clock only reports — each escalation stays the person's explicit action.",
      meta: { nextRung: rung, count },
    });
  }

  if (neverDispatched > 0) {
    findings.push({
      kind: "sent_without_dispatch",
      severity: "note",
      message:
        `${neverDispatched} case(s) are marked SENT but no email ever actually left the Outbox ` +
        "(QUEUED only — expected without SMTP credentials). No clock runs on a demand that never went out.",
    });
  }

  return {
    ok: true,
    summary:
      `${sentCases.length} SENT case(s): ${insideWindow} inside their response window, ` +
      `${totalExpired} past deadline, ${neverDispatched} never actually dispatched, ` +
      `${unmapped} in verticals without a graphed right.`,
    findings,
  };
}
