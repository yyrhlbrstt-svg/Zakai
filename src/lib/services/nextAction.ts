/**
 * Single next-action ranker for dashboard, Money Hub, and assistant.
 * Order is closure-first:
 * fee → inbound SavingsProof → exhausted SENT → needs outreach email →
 * inactive Mandate → pre-send Mandate → SENT wait → /money.
 * Surfaces that disagree here stall the loop and erode trust.
 */

import { MAX_AGENT_ROUNDS } from "@/lib/services/loopLimits";

export type NextActionKind =
  | "pending_fee"
  | "proposed_saving"
  | "sent_exhausted"
  | "needs_outreach"
  | "mandate_inactive"
  | "pre_send"
  | "sent_wait"
  | "start_money";

export type NextActionCaseInput = {
  id: string;
  status: string;
  fee?: { amount: number; status: string } | null;
  /** Agent auto-follow-up rounds already sent (Outbox). */
  agentRound?: number;
  /**
   * Whether the case has an ACTIVE Mandate. Only meaningful for SENT.
   * Omit/undefined = unknown (do not surface mandate_inactive).
   */
  mandateActive?: boolean;
  /**
   * Whether Case.counterpartyEmail looks usable.
   * Meaningful for SENT and pre-send (dispatch needs a destination).
   * Omit/undefined = unknown (do not surface needs_outreach).
   */
  hasOutreachEmail?: boolean;
};

export type ProposedSavingHint = {
  newAmountShekels: number;
};

export type RankedNextAction =
  | { kind: "pending_fee"; caseId: string; feeAmountAgorot: number }
  | { kind: "proposed_saving"; caseId: string; newAmountShekels: number }
  | { kind: "sent_exhausted"; caseId: string; agentRound: number }
  | { kind: "needs_outreach"; caseId: string }
  | { kind: "mandate_inactive"; caseId: string }
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

  // After max written rounds the agent cannot progress — user must record or close.
  const exhausted = cases.find(
    (c) =>
      c.status === "SENT" &&
      !proposedByCaseId.has(c.id) &&
      (c.agentRound ?? 0) >= MAX_AGENT_ROUNDS,
  );
  if (exhausted) {
    return {
      kind: "sent_exhausted",
      caseId: exhausted.id,
      agentRound: exhausted.agentRound ?? MAX_AGENT_ROUNDS,
    };
  }

  // Soft-open left a case without a provider inbox — collect before send/follow-up.
  const needsOutreach = cases.find(
    (c) =>
      (c.status === "SENT" || PRE_SEND.has(c.status)) &&
      !proposedByCaseId.has(c.id) &&
      c.hasOutreachEmail === false,
  );
  if (needsOutreach) {
    return { kind: "needs_outreach", caseId: needsOutreach.id };
  }

  // SENT without ACTIVE Mandate — follow-ups and cron are blocked until reissue.
  const inactiveMandate = cases.find(
    (c) =>
      c.status === "SENT" &&
      !proposedByCaseId.has(c.id) &&
      c.mandateActive === false,
  );
  if (inactiveMandate) {
    return { kind: "mandate_inactive", caseId: inactiveMandate.id };
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

/** Human/agent snapshot line — assistant must end replies with that path. */
export function nextActionInstruction(action: RankedNextAction): string {
  switch (action.kind) {
    case "pending_fee":
      return `NEXT_ACTION: Collect success fee — /dashboard?case=${action.caseId}&payFee=1 (₪${(action.feeAmountAgorot / 100).toFixed(2)} pending).`;
    case "proposed_saving":
      return `NEXT_ACTION: One-tap record SavingsProof — /dashboard?case=${action.caseId} (proposed ₪${action.newAmountShekels}). Do NOT invent amounts. Do NOT open a new case.`;
    case "sent_exhausted":
      return `NEXT_ACTION: Written rounds exhausted (${action.agentRound}/${MAX_AGENT_ROUNDS}) — /dashboard?case=${action.caseId}. Record the real new amount from a written reply, mark no change, or pivot (cancel/competitor). Do NOT draft another delay follow-up. Do NOT open a new case.`;
    case "needs_outreach":
      return `NEXT_ACTION: Enter provider outreach email — /dashboard?case=${action.caseId}. Mandate send / follow-ups cannot leave without a destination. Do NOT invent an inbox. Do NOT open a new case.`;
    case "mandate_inactive":
      return `NEXT_ACTION: Re-issue ACTIVE Mandate — /dashboard?case=${action.caseId}. Follow-ups are blocked until Mandate is ACTIVE again. Do NOT open a new case.`;
    case "pre_send":
      return `NEXT_ACTION: Finish Mandate send — /dashboard?case=${action.caseId} (status=${action.status}). Verify ownership if needed, then one-tap send. Do NOT start another vertical.`;
    case "sent_wait":
      return `NEXT_ACTION: Close the loop — /dashboard?case=${action.caseId}. If they replied: record new amount (SavingsProof). If silent: draft/send written follow-up.`;
    case "start_money":
      return "NEXT_ACTION: Start in /money (scan → case → Mandate). Only then other agent verticals.";
  }
}
