import "server-only";
import { prisma } from "@/lib/prisma";
import { inboundProposedRemainingShekels } from "@/lib/fee";
import { feeBasisForVertical } from "@/lib/verticals";

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

type InboundRow = {
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

function mapExtractToProposal(
  parsed: InboundRow,
  rowCreatedAt: Date,
  amountOriginalShekels: number,
  vertical: string,
): ProposedSaving | null {
  if (parsed.direction !== "inbound") return null;
  const ex = parsed.extract;
  if (!ex?.found || ex.newAmountShekels == null || (ex.confidence ?? 0) < 0.6) return null;
  if (ex.newAmountShekels < 0 || ex.newAmountShekels > 100_000) return null;

  const basis = feeBasisForVertical(vertical);
  const mapped = inboundProposedRemainingShekels(
    basis,
    amountOriginalShekels,
    Math.round(ex.newAmountShekels),
  );

  return {
    newAmountShekels: mapped,
    confidence: ex.confidence ?? 0,
    authorizationCode: ex.authorizationCode ?? null,
    from: parsed.from ?? null,
    subject: parsed.subject ?? null,
    receivedAt: rowCreatedAt,
  };
}

export async function getProposedSaving(caseId: string): Promise<ProposedSaving | null> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { vertical: true, amountOriginal: true },
  });
  if (!kase) return null;
  const amountOriginalShekels = Math.round(kase.amountOriginal / 100);

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
      const parsed = JSON.parse(row.body) as InboundRow;
      const proposal = mapExtractToProposal(parsed, row.createdAt, amountOriginalShekels, kase.vertical);
      if (proposal) return proposal;
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

  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds } },
    select: { id: true, vertical: true, amountOriginal: true },
  });
  const caseMeta = new Map(
    cases.map((c) => [c.id, { vertical: c.vertical, amountOriginalShekels: Math.round(c.amountOriginal / 100) }]),
  );

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
    const meta = caseMeta.get(row.caseId);
    if (!meta) continue;
    try {
      const parsed = JSON.parse(row.body) as InboundRow;
      const proposal = mapExtractToProposal(
        parsed,
        row.createdAt,
        meta.amountOriginalShekels,
        meta.vertical,
      );
      if (proposal) map.set(row.caseId, proposal);
    } catch {
      continue;
    }
  }
  return map;
}
