import { describe, expect, it } from "vitest";
import { MAX_AGENT_ROUNDS } from "./loopLimits";
import { nextActionInstruction, rankNextAction } from "./nextAction";

describe("rankNextAction", () => {
  it("prioritizes pending fee over everything", () => {
    const action = rankNextAction(
      [
        { id: "a", status: "SENT", agentRound: MAX_AGENT_ROUNDS },
        { id: "b", status: "SAVED", fee: { amount: 1800, status: "PENDING" } },
        { id: "c", status: "ANALYZED" },
      ],
      new Map([["a", { newAmountShekels: 80 }]]),
    );
    expect(action).toEqual({
      kind: "pending_fee",
      caseId: "b",
      feeAmountAgorot: 1800,
    });
  });

  it("prioritizes inbound proposed saving over pre-send", () => {
    const action = rankNextAction(
      [
        { id: "pre", status: "VERIFIED" },
        { id: "sent", status: "SENT" },
      ],
      new Map([["sent", { newAmountShekels: 99 }]]),
    );
    expect(action).toEqual({
      kind: "proposed_saving",
      caseId: "sent",
      newAmountShekels: 99,
    });
  });

  it("forces close when written rounds are exhausted", () => {
    const action = rankNextAction([
      { id: "pre", status: "APPROVED" },
      { id: "stuck", status: "SENT", agentRound: MAX_AGENT_ROUNDS },
    ]);
    expect(action).toEqual({
      kind: "sent_exhausted",
      caseId: "stuck",
      agentRound: MAX_AGENT_ROUNDS,
    });
  });

  it("prefers pre-send over silent SENT that still has rounds left", () => {
    const action = rankNextAction([
      { id: "sent", status: "SENT", agentRound: 1, mandateActive: true },
      { id: "pre", status: "APPROVED" },
    ]);
    expect(action).toEqual({ kind: "pre_send", caseId: "pre", status: "APPROVED" });
  });

  it("surfaces needs_outreach above mandate_inactive and pre-send", () => {
    const action = rankNextAction([
      { id: "pre", status: "VERIFIED" },
      {
        id: "no-mail",
        status: "SENT",
        agentRound: 1,
        mandateActive: true,
        hasOutreachEmail: false,
      },
      {
        id: "dead",
        status: "SENT",
        agentRound: 1,
        mandateActive: false,
        hasOutreachEmail: true,
      },
    ]);
    expect(action).toEqual({ kind: "needs_outreach", caseId: "no-mail" });
  });

  it("surfaces mandate_inactive above pre-send and sent_wait", () => {
    const action = rankNextAction([
      { id: "pre", status: "VERIFIED" },
      {
        id: "dead",
        status: "SENT",
        agentRound: 1,
        mandateActive: false,
        hasOutreachEmail: true,
      },
      {
        id: "ok",
        status: "SENT",
        agentRound: 0,
        mandateActive: true,
        hasOutreachEmail: true,
      },
    ]);
    expect(action).toEqual({ kind: "mandate_inactive", caseId: "dead" });
  });

  it("does not invent stuck kinds when outreach/mandate flags are unknown", () => {
    expect(rankNextAction([{ id: "s", status: "SENT", agentRound: 0 }])).toEqual({
      kind: "sent_wait",
      caseId: "s",
    });
  });

  it("falls back to sent_wait then start_money", () => {
    expect(
      rankNextAction([
        {
          id: "s",
          status: "SENT",
          agentRound: 0,
          mandateActive: true,
          hasOutreachEmail: true,
        },
      ]),
    ).toEqual({
      kind: "sent_wait",
      caseId: "s",
    });
    expect(rankNextAction([])).toEqual({ kind: "start_money" });
  });
});

describe("nextActionInstruction", () => {
  it("emits a single dashboard link for proposed saving", () => {
    const line = nextActionInstruction({
      kind: "proposed_saving",
      caseId: "c1",
      newAmountShekels: 120,
    });
    expect(line).toContain("/dashboard?case=c1");
    expect(line).toContain("120");
  });

  it("tells the agent not to draft another delay after exhaustion", () => {
    const line = nextActionInstruction({
      kind: "sent_exhausted",
      caseId: "c9",
      agentRound: MAX_AGENT_ROUNDS,
    });
    expect(line).toContain("c9");
    expect(line).toMatch(/Do NOT draft another delay/i);
  });

  it("points inactive Mandate at dashboard re-issue", () => {
    const line = nextActionInstruction({ kind: "mandate_inactive", caseId: "c2" });
    expect(line).toContain("/dashboard?case=c2");
    expect(line).toMatch(/Re-issue ACTIVE Mandate/i);
  });

  it("points missing outreach at dashboard email field", () => {
    const line = nextActionInstruction({ kind: "needs_outreach", caseId: "c3" });
    expect(line).toContain("/dashboard?case=c3");
    expect(line).toMatch(/outreach email/i);
  });
});
