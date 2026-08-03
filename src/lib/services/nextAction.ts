/**
 * Single next-action ranker for dashboard, Money Hub, and assistant.
 * Order is closure-first: fee → inbound SavingsProof → pre-send Mandate → SENT wait → /money.
 * Surfaces that disagree here stall the loop and erode trust.
 */

export type NextActionKind =
  | "pending_fee"
  | "proposed_saving"
  | "pre_send"
  | "sent_wait"
  | "start_money";

export type NextActionCaseInput = {
  id: string;
  status: string;
  fee?: { amount: number; status: string } | null;
};

export type ProposedSavingHint = {
  newAmountShekels: number;
};

export type RankedNextAction =
  | { kind: "pending_fee"; caseId: string; feeAmountAgorot: number }
  | { kind: "proposed_saving"; caseId: string; newAmountShekels: number }
  | { kind: "pre_send"; caseId: string; status: string }
  | { kind: "sent_wait"; caseId: string }
  | { kind: "start_money" };

const PRE_SEND = new Set(["ANALYZED", "APPROVED", "VERIFIED"]);

/**
 * Rank the single highest-ROI unfinished loop.
 * `proposedByCaseId` maps SENT case ids → inbound proposed new monthly/lump amount.
 */
export function rankNextAction(
  cases: readonly NextActionCaseInput[],
  proposedByCaseId: ReadonlyMap<string, ProposedSavingHint> = new Map(),
): RankedNextAction {
  const pendingFee = cases.find(
    (c) => c.fee && c.fee.status === "PENDING" && c.fee.amount > 0,
  );
  if (pendingFee?.fee) {
    return {
      kind: "pending_fee",
      caseId: pendingFee.id,
      feeAmountAgorot: pendingFee.fee.amount,
    };
  }

  for (const c of cases) {
    if (c.status !== "SENT") continue;
    const proposed = proposedByCaseId.get(c.id);
    if (proposed) {
      return {
        kind: "proposed_saving",
        caseId: c.id,
        newAmountShekels: proposed.newAmountShekels,
      };
    }
  }

  const preSend = cases.find((c) => PRE_SEND.has(c.status));
  if (preSend) {
    return { kind: "pre_send", caseId: preSend.id, status: preSend.status };
  }

  const sent = cases.find((c) => c.status === "SENT");
  if (sent) {
    return { kind: "sent_wait", caseId: sent.id };
  }

  return { kind: "start_money" };
}

/** Human/agent snapshot line — assistant must end replies with this path. */
export function nextActionInstruction(action: RankedNextAction): string {
  switch (action.kind) {
    case "pending_fee":
      return `NEXT_ACTION: Collect success fee — /dashboard?case=${action.caseId}&payFee=1 (₪${(action.feeAmountAgorot / 100).toFixed(2)} pending).`;
    case "proposed_saving":
      return `NEXT_ACTION: One-tap record SavingsProof — /dashboard?case=${action.caseId} (proposed ₪${action.newAmountShekels}). Do NOT invent amounts. Do NOT open a new case.`;
    case "pre_send":
      return `NEXT_ACTION: Finish Mandate send — /dashboard?case=${action.caseId} (status=${action.status}). Approve/verify/send. Do NOT start another vertical.`;
    case "sent_wait":
      return `NEXT_ACTION: Close the loop — /dashboard?case=${action.caseId}. If they replied: record new amount (SavingsProof). If silent: draft/send written follow-up.`;
    case "start_money":
      return "NEXT_ACTION: Start in /money (scan → case → Mandate). Only then other agent verticals.";
  }
}
