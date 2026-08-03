import { describe, expect, it } from "vitest";
import { nextActionInstruction, rankNextAction } from "./nextAction";

describe("rankNextAction", () => {
  it("prioritizes pending fee over everything", () => {
    const action = rankNextAction(
      [
        { id: "a", status: "SENT" },
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

  it("prefers pre-send over silent SENT", () => {
    const action = rankNextAction([
      { id: "sent", status: "SENT" },
      { id: "pre", status: "APPROVED" },
    ]);
    expect(action).toEqual({ kind: "pre_send", caseId: "pre", status: "APPROVED" });
  });

  it("falls back to sent_wait then start_money", () => {
    expect(rankNextAction([{ id: "s", status: "SENT" }])).toEqual({
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
});
