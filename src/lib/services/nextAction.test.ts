import { describe, expect, it } from "vitest";
import { MAX_AGENT_ROUNDS } from "./loopLimits";
import {
  ensureReplyEndsWithNextAction,
  nextActionHref,
  nextActionInstruction,
  rankNextAction,
} from "./nextAction";

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

  it("surfaces mandate_inactive for SAVED pending fee when Mandate is inactive", () => {
    const action = rankNextAction([
      {
        id: "stuck-fee",
        status: "SAVED",
        fee: { amount: 1800, status: "PENDING" },
        mandateActive: false,
      },
      { id: "pre", status: "VERIFIED" },
    ]);
    expect(action).toEqual({ kind: "mandate_inactive", caseId: "stuck-fee" });
    expect(nextActionHref(action)).toBe("/money?case=stuck-fee");
  });

  it("still ranks pending_fee when Mandate is ACTIVE on SAVED", () => {
    const action = rankNextAction([
      {
        id: "pay",
        status: "SAVED",
        fee: { amount: 1800, status: "PENDING" },
        mandateActive: true,
      },
    ]);
    expect(action).toEqual({
      kind: "pending_fee",
      caseId: "pay",
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

  it("surfaces needs_outreach for pre-send soft-open without inbox", () => {
    const action = rankNextAction([
      {
        id: "pre-no-mail",
        status: "APPROVED",
        hasOutreachEmail: false,
      },
      {
        id: "sent-ok",
        status: "SENT",
        agentRound: 0,
        mandateActive: true,
        hasOutreachEmail: true,
      },
    ]);
    expect(action).toEqual({ kind: "needs_outreach", caseId: "pre-no-mail" });
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

  it("breaks ties by highest expected recovery", () => {
    const action = rankNextAction([
      {
        id: "small",
        status: "SENT",
        agentRound: 0,
        mandateActive: true,
        hasOutreachEmail: true,
        expectedRecoveryAgorot: 1_000,
      },
      {
        id: "big",
        status: "SENT",
        agentRound: 0,
        mandateActive: true,
        hasOutreachEmail: true,
        expectedRecoveryAgorot: 15_000,
      },
    ]);
    expect(action).toEqual({ kind: "sent_wait", caseId: "big" });
  });
});

describe("ensureReplyEndsWithNextAction", () => {
  it("appends href when the model omitted it", () => {
    expect(ensureReplyEndsWithNextAction("תשלח עכשיו.", "/dashboard?case=c1")).toBe(
      "תשלח עכשיו.\n\n→ /dashboard?case=c1",
    );
  });

  it("leaves answer alone when href already present", () => {
    const a = "פתח /dashboard?case=c1 עכשיו.";
    expect(ensureReplyEndsWithNextAction(a, "/dashboard?case=c1")).toBe(a);
  });
});

describe("nextActionHref", () => {
  it("maps start_money and open-loop actions to /money (with case deep-link)", () => {
    expect(nextActionHref({ kind: "start_money" })).toBe("/money");
    expect(nextActionHref({ kind: "pre_send", caseId: "c1", status: "VERIFIED" })).toBe(
      "/money?case=c1",
    );
    expect(nextActionHref({ kind: "proposed_saving", caseId: "c1", newAmountShekels: 80 })).toBe(
      "/money?case=c1",
    );
  });

  it("keeps fee collection on dashboard checkout", () => {
    expect(
      nextActionHref({ kind: "pending_fee", caseId: "c1", feeAmountAgorot: 1800 }),
    ).toBe("/money?case=c1&payFee=1");
  });
});

describe("nextActionInstruction", () => {
  it("emits a single /money finish surface for proposed saving", () => {
    const line = nextActionInstruction({
      kind: "proposed_saving",
      caseId: "c1",
      newAmountShekels: 120,
    });
    expect(line).toContain("/money");
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

  it("points inactive Mandate at /money re-issue", () => {
    const line = nextActionInstruction({ kind: "mandate_inactive", caseId: "c2" });
    expect(line).toContain("/money");
    expect(line).toMatch(/Re-issue ACTIVE Mandate/i);
  });

  it("points missing outreach at /money email field", () => {
    const line = nextActionInstruction({ kind: "needs_outreach", caseId: "c3" });
    expect(line).toContain("/money");
    expect(line).toMatch(/outreach email/i);
  });
});
