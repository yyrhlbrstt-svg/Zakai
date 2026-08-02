import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  aggregateInboundPressure,
  disclosedInboundPressure,
  INSTITUTION_PROVIDER_MAP,
} from "@/lib/institutionInboundPressure";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

/**
 * Public aggregate: how much documented consumer outbound volume targets each
 * institution slug. Not total mail to the bank — only Zakai cases that
 * reached dispatch to a mapped provider key.
 */
export async function GET() {
  const rows = await prisma.case
    .findMany({
      where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
      select: { provider: true, status: true },
    })
    .catch(() => [] as { provider: string; status: string }[]);

  const all = aggregateInboundPressure(rows);
  const leaders = disclosedInboundPressure(all);

  return NextResponse.json(
    {
      ok: true,
      disclaimer:
        "Counts are de-identified Zakai consumer cases dispatched to mapped provider keys — not regulatory filings or total inbound to the institution.",
      mappedInstitutionIds: Object.keys(INSTITUTION_PROVIDER_MAP),
      totalMappedDispatched: all.reduce((s, r) => s + r.dispatchedCases, 0),
      disclosedCount: leaders.length,
      pressure: leaders.map((r) => ({
        institutionId: r.institutionId,
        dispatchedCases: r.dispatchedCases,
        savedCases: r.savedCases,
      })),
    },
    { headers: CORS },
  );
}
