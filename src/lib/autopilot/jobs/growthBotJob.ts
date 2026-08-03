import "server-only";

import { prisma } from "@/lib/prisma";
import type { AutopilotJobResult } from "../findings";

/** Suggests content topics from de-identified outcomes — no auto-post without credentials. */
export async function runGrowthBot(): Promise<AutopilotJobResult> {
  const hasSocial =
    Boolean(process.env.TIKTOK_ACCESS_TOKEN?.trim()) ||
    Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim());

  const since = new Date(Date.now() - 14 * 86_400_000);
  const rows = await prisma.strategyOutcome.findMany({
    where: { createdAt: { gte: since }, paid: true },
    select: { vertical: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.vertical, (counts.get(r.vertical) ?? 0) + 1);
  }
  const topics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vertical, paidOutcomes]) => ({
      vertical,
      paidOutcomes,
      suggestedHook: `Documented wins in ${vertical} — check what you are owed`,
    }));

  if (!hasSocial) {
    return {
      ok: true,
      summary: "Growth Bot: digest only (no social API keys).",
      findings: [
        {
          kind: "growth_digest",
          severity: "note",
          message: "Founder can film from topics below; auto-post disabled.",
          meta: { topics },
        },
      ],
    };
  }

  return {
    ok: true,
    summary: "Growth Bot: social credentials present — scheduling not implemented in-repo.",
    findings: [
      {
        kind: "growth_api_present",
        severity: "note",
        message: "Wire Buffer/Later or platform API in a separate worker; export topics:",
        meta: { topics },
      },
    ],
  };
}
