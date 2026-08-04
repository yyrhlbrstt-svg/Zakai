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
   * Whether the case has an ACTIVE Mandate. Meaningful for SENT follow-ups
   * and for SAVED + PENDING fee (checkout requires matching live jti).
   * Omit/undefined = unknown (do not surface mandate_inactive).
   */
  mandateActive?: boolean;
  /**
   * Whether outreach destination is resolvable (counterparty OR catalog).
   * Meaningful for SENT and pre-send (dispatch needs a destination).
   * Omit/undefined = unknown (do not surface needs_outreach).
   */
  hasOutreachEmail?: boolean;
  /**
   * Expected recovery in agorot (amountOriginal − targetAmount, floored at 0).
   * Used to break ties within the same action kind — biggest win first.
   */
  expectedRecoveryAgorot?: number;
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

function recovery(c: NextActionCaseInput): number {
  return c.expectedRecoveryAgorot ?? 0;
}

/** Within a kind, pick the case with the highest expected recovery (then first). */
function pickBest(
  cases: readonly NextActionCaseInput[],
  pred: (c: NextActionCaseInput) => boolean,
): NextActionCaseInput | undefined {
  let best: NextActionCaseInput | undefined;
  for (const c of cases) {
    if (!pred(c)) continue;
    if (!best || recovery(c) > recovery(best)) best = c;
  }
  return best;
}

/**
 * Rank the single highest-ROI unfinished loop.
 * `proposedByCaseId` maps SENT case ids → inbound proposed new monthly/lump amount.
 */
export function rankNextAction(
  cases: readonly NextActionCaseInput[],
  proposedByCaseId: ReadonlyMap<string, ProposedSavingHint> = new Map(),
): RankedNextAction {
  // Collect fee only when Mandate is not known-inactive — otherwise checkout
  // refuses (#88) and payFee=1 is a dead end until reissue rebinds the jti.
  const pendingFee = pickBest(
    cases,
    (c) =>
      Boolean(c.fee && c.fee.status === "PENDING" && c.fee.amount > 0) &&
      c.mandateActive !== false,
  );
  if (pendingFee?.fee) {
    return {
      kind: "pending_fee",
      caseId: pendingFee.id,
      feeAmountAgorot: pendingFee.fee.amount,
    };
  }

  const withProposal = pickBest(
    cases,
    (c) => c.status === "SENT" && proposedByCaseId.has(c.id),
  );
  if (withProposal) {
    const proposed = proposedByCaseId.get(withProposal.id)!;
    return {
      kind: "proposed_saving",
      caseId: withProposal.id,
      newAmountShekels: proposed.newAmountShekels,
    };
  }

  // After max written rounds the agent cannot progress — user must record or close.
  const exhausted = pickBest(
    cases,
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
  const needsOutreach = pickBest(
    cases,
    (c) =>
      (c.status === "SENT" || PRE_SEND.has(c.status)) &&
      !proposedByCaseId.has(c.id) &&
      c.hasOutreachEmail === false,
  );
  if (needsOutreach) {
    return { kind: "needs_outreach", caseId: needsOutreach.id };
  }

  // SENT without ACTIVE Mandate — follow-ups blocked until reissue.
  // SAVED + PENDING fee without ACTIVE Mandate — checkout blocked until reissue.
  const inactiveMandate = pickBest(
    cases,
    (c) =>
      c.mandateActive === false &&
      ((c.status === "SENT" && !proposedByCaseId.has(c.id)) ||
        (c.status === "SAVED" &&
          Boolean(c.fee && c.fee.status === "PENDING" && c.fee.amount > 0))),
  );
  if (inactiveMandate) {
    return { kind: "mandate_inactive", caseId: inactiveMandate.id };
  }

  const preSend = pickBest(cases, (c) => PRE_SEND.has(c.status));
  if (preSend) {
    return { kind: "pre_send", caseId: preSend.id, status: preSend.status };
  }

  const sent = pickBest(cases, (c) => c.status === "SENT");
  if (sent) {
    return { kind: "sent_wait", caseId: sent.id };
  }

  return { kind: "start_money" };
}

/** Path the assistant must end with (enforced in ask route). */
export function nextActionHref(
  action: RankedNextAction,
  opts?: { paymentsLive?: boolean },
): string {
  switch (action.kind) {
    case "pending_fee":
      // Invent payFee=1 only when a real PSP is live — mock must not auto-checkout.
      return opts?.paymentsLive === true
        ? `/money?case=${action.caseId}&payFee=1`
        : `/money?case=${action.caseId}`;
    case "proposed_saving":
    case "sent_exhausted":
    case "needs_outreach":
    case "mandate_inactive":
    case "pre_send":
    case "sent_wait":
      return `/money?case=${action.caseId}`;
    case "start_money":
      return "/money";
  }
}

/**
 * If the model omitted the required next-action path, append one closing line.
 * Never invent a second plan — only reinforce the ranked href.
 */
export function ensureReplyEndsWithNextAction(answer: string, href: string): string {
  const trimmed = answer.trim();
  if (!trimmed) return `→ ${href}`;
  if (trimmed.includes(href)) return trimmed;
  return `${trimmed}\n\n→ ${href}`;
}

/** Human/agent snapshot line — assistant must end replies with that path. */
export function nextActionInstruction(
  action: RankedNextAction,
  opts?: { paymentsLive?: boolean },
): string {
  switch (action.kind) {
    case "pending_fee": {
      const href = nextActionHref(action, opts);
      return `NEXT_ACTION: Collect success fee — ${href} (₪${(action.feeAmountAgorot / 100).toFixed(2)} pending).`;
    }
    case "proposed_saving":
      return `NEXT_ACTION: One-tap record SavingsProof — /money?case=${action.caseId} (proposed ₪${action.newAmountShekels}). Do NOT invent amounts. Do NOT open a new case.`;
    case "sent_exhausted":
      return `NEXT_ACTION: Written rounds exhausted (${action.agentRound}/${MAX_AGENT_ROUNDS}) — /money?case=${action.caseId}. Record the real new amount from a written reply, mark no change, or pivot (cancel/competitor). Do NOT draft another delay follow-up. Do NOT open a new case.`;
    case "needs_outreach":
      return `NEXT_ACTION: Enter provider outreach email — /money?case=${action.caseId}. Mandate send / follow-ups cannot leave without a destination. Do NOT invent an inbox. Do NOT open a new case.`;
    case "mandate_inactive":
      return `NEXT_ACTION: Re-issue ACTIVE Mandate — /money?case=${action.caseId}. Follow-ups and fee checkout stay blocked until Mandate is ACTIVE again (reissue rebinds PENDING fee jti). Do NOT open a new case.`;
    case "pre_send":
      return `NEXT_ACTION: Finish Mandate send — /money?case=${action.caseId} (status=${action.status}). Verify ownership if needed, then one-tap send. Do NOT start another vertical.`;
    case "sent_wait":
      return `NEXT_ACTION: Close the loop — /money?case=${action.caseId}. If they replied: record new amount (SavingsProof). If silent: draft/send written follow-up. Do NOT open a new case.`;
    case "start_money":
      return "NEXT_ACTION: Start in /money (scan → case → Mandate). Only then other agent verticals.";
  }
}
