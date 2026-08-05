import "server-only";

import { prisma } from "@/lib/prisma";
import {
  aggregateInboundPressureTrend,
  CASE_PRESSURE_SELECT,
  type InboundPressureDatedRow,
  type InboundPressureTrend,
} from "@/lib/institutionInboundPressure";
import { singleflight } from "@/lib/scale/singleflight";

/**
 * The same disclosed Case volume /api/institution/inbound-pressure already
 * publishes as a free public snapshot, licensed as a two-window trend for a
 * regulator's own risk team or an institution's own compliance desk —
 * direction, not just level. De-identified: Case rows, never a User FK
 * exposed beyond what the free endpoint already carries.
 */
export async function loadInstitutionRiskTrend(): Promise<InboundPressureTrend[]> {
  return singleflight("institution-risk-trend", 300_000, async () => {
    try {
      const cases = await prisma.case.findMany({
        where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
        select: { ...CASE_PRESSURE_SELECT, createdAt: true },
      });
      const rows: InboundPressureDatedRow[] = cases.map((c) => ({
        provider: c.provider,
        status: c.status,
        mandateAudience: c.authorization?.mandateAudience ?? null,
        createdAt: c.createdAt,
      }));
      return aggregateInboundPressureTrend(rows);
    } catch {
      // A DB hiccup must never crash a paid API call — same resilience
      // pattern as loadSystemicPatternReport/loadFairnessScores.
      return [];
    }
  });
}
