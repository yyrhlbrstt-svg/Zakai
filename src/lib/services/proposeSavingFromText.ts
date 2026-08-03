import "server-only";
import { prisma } from "@/lib/prisma";
import { extractSavingsFromEmail } from "@/lib/ai";
import { resolveInboundRecordAmountShekels } from "@/lib/fee";
import { feeBasisForVertical } from "@/lib/verticals";
import { CaseError } from "@/lib/services/cases";
import { getProposedSaving, type ProposedSaving } from "@/lib/services/proposedSaving";

export type ProposeSavingExtract = {
  found: boolean;
  newAmountShekels: number | null;
  authorizationCode: string | null;
  confidence: number;
  reason?: string;
  amountKind?: "monthly" | "remaining" | "refund" | null;
};

/**
 * User-pasted provider reply → same Outbox "inbound" proposal shape as the
 * email webhook. Closes SENT → one-tap SavingsProof without waiting for SMTP
 * inbound configuration. Never auto-records; dashboard confirm stays the gate.
 */
export async function proposeSavingFromText(
  caseId: string,
  userId: string,
  rawText: string,
): Promise<{ proposed: ProposedSaving | null; extract: ProposeSavingExtract }> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, userId },
    select: { id: true, status: true, vertical: true, amountOriginal: true },
  });
  if (!kase) throw new CaseError("NOT_FOUND");
  if (kase.status !== "SENT") throw new CaseError("INVALID_STATUS");

  const bodyText = rawText.trim().slice(0, 12_000);
  if (bodyText.length < 8) throw new CaseError("EMPTY_TEXT");

  const originalShekels = Math.round(kase.amountOriginal / 100);
  const basis = feeBasisForVertical(kase.vertical);

  let extract: ProposeSavingExtract;
  try {
    const first = await extractSavingsFromEmail(
      bodyText,
      basis === "lump"
        ? { feeBasis: "lump", originalAmountShekels: originalShekels, vertical: kase.vertical }
        : undefined,
    );
    extract = {
      found: first.found,
      newAmountShekels: first.newAmountShekels,
      authorizationCode: first.authorizationCode,
      confidence: first.confidence,
      reason: first.reason,
      amountKind: first.amountKind ?? null,
    };
  } catch {
    extract = {
      found: false,
      newAmountShekels: null,
      authorizationCode: null,
      confidence: 0,
      reason: "extract_failed",
    };
  }

  if (!extract.authorizationCode) {
    const codeMatch = bodyText.match(/\b(ZK-[A-Z0-9]{4,16})\b/i);
    if (codeMatch) {
      extract = { ...extract, authorizationCode: codeMatch[1].toUpperCase() };
    }
  }

  let recordAmountShekels: number | null = null;
  if (extract.newAmountShekels != null) {
    recordAmountShekels = resolveInboundRecordAmountShekels(
      basis,
      originalShekels,
      extract.newAmountShekels,
      extract.amountKind ?? null,
    );
  }

  const extractLogged = {
    ...extract,
    ...(recordAmountShekels != null ? { recordAmountShekels } : {}),
  };

  const note = JSON.stringify({
    direction: "inbound",
    from: "paste@user",
    subject: "user-paste",
    extract: extractLogged,
    matchedCaseId: caseId,
    matchMethod: "paste",
  });

  await prisma.outbox.create({
    data: {
      channel: "EMAIL",
      toAddress: "paste@user",
      subject: "[paste] provider reply",
      body: note,
      caseId,
      status: "QUEUED",
      providerMessageId: "inbound",
    },
  });

  const proposed = await getProposedSaving(caseId);
  return { proposed, extract };
}
