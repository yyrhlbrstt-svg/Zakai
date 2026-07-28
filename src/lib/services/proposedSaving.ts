import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * When inbound email matches a SENT case, we log the extract in Outbox
 * (direction: inbound). This helper surfaces the latest high-confidence
 * proposal so the dashboard can offer one-tap "record saving" — closing the
 * proof loop without the user re-typing the amount from the email.
 */

export interface ProposedSaving {
  newAmountShekels: number;
  confidence: number;
  authorizationCode: string | null;
  from: string | null;
  subject: string | null;
  receivedAt: Date;
}

export async function getProposedSaving(caseId: string): Promise<ProposedSaving | null> {
  const rows = await prisma.outbox.findMany({
    where: {
      caseId,
      providerMessageId: "inbound",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.body) as {
        direction?: string;
        from?: string;
        subject?: string;
        extract?: {
          found?: boolean;
          newAmountShekels?: number | null;
          confidence?: number;
          authorizationCode?: string | null;
        };
      };
      if (parsed.direction !== "inbound") continue;
      const ex = parsed.extract;
      if (!ex?.found || ex.newAmountShekels == null || (ex.confidence ?? 0) < 0.6) continue;
      if (ex.newAmountShekels < 0 || ex.newAmountShekels > 100_000) continue;

      return {
        newAmountShekels: Math.round(ex.newAmountShekels),
        confidence: ex.confidence ?? 0,
        authorizationCode: ex.authorizationCode ?? null,
        from: parsed.from ?? null,
        subject: parsed.subject ?? null,
        receivedAt: row.createdAt,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Batch for dashboard — one query for many case ids. */
export async function getProposedSavingsMap(
  caseIds: string[],
): Promise<Map<string, ProposedSaving>> {
  const map = new Map<string, ProposedSaving>();
  if (caseIds.length === 0) return map;

  const rows = await prisma.outbox.findMany({
    where: {
      caseId: { in: caseIds },
      providerMessageId: "inbound",
    },
    orderBy: { createdAt: "desc" },
    take: caseIds.length * 3,
  });

  for (const row of rows) {
    if (!row.caseId || map.has(row.caseId)) continue;
    try {
      const parsed = JSON.parse(row.body) as {
        direction?: string;
        from?: string;
        subject?: string;
        extract?: {
          found?: boolean;
          newAmountShekels?: number | null;
          confidence?: number;
          authorizationCode?: string | null;
        };
      };
      if (parsed.direction !== "inbound") continue;
      const ex = parsed.extract;
      if (!ex?.found || ex.newAmountShekels == null || (ex.confidence ?? 0) < 0.6) continue;
      if (ex.newAmountShekels < 0 || ex.newAmountShekels > 100_000) continue;

      map.set(row.caseId, {
        newAmountShekels: Math.round(ex.newAmountShekels),
        confidence: ex.confidence ?? 0,
        authorizationCode: ex.authorizationCode ?? null,
        from: parsed.from ?? null,
        subject: parsed.subject ?? null,
        receivedAt: row.createdAt,
      });
    } catch {
      continue;
    }
  }
  return map;
}
