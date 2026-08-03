import { describe, expect, it } from "vitest";
import { nextActionHref, rankNextAction } from "./nextAction";

/**
 * Finish-surface contract: open-loop kinds deep-link to /money?case=,
 * fee collection alone stays on dashboard checkout.
 */
describe("finish surface contract", () => {
  it("routes every non-fee open-loop kind to /money?case=", () => {
    const kinds = [
      rankNextAction([{ id: "c1", status: "SENT", agentRound: 0, mandateActive: true, hasOutreachEmail: true }]),
      rankNextAction([{ id: "c1", status: "APPROVED", hasOutreachEmail: true }]),
      rankNextAction([{ id: "c1", status: "SENT", hasOutreachEmail: false }]),
      rankNextAction(
        [{ id: "c1", status: "SENT", agentRound: 0, mandateActive: true, hasOutreachEmail: true }],
        new Map([["c1", { newAmountShekels: 90 }]]),
      ),
    ];
    for (const action of kinds) {
      expect(action.kind).not.toBe("start_money");
      expect(action.kind).not.toBe("pending_fee");
      expect(nextActionHref(action)).toBe("/money?case=c1");
    }
  });

  it("keeps success-fee collection on dashboard", () => {
    const action = rankNextAction([
      { id: "c1", status: "SAVED", fee: { amount: 1800, status: "PENDING" } },
    ]);
    expect(action.kind).toBe("pending_fee");
    expect(nextActionHref(action)).toBe("/dashboard?case=c1&payFee=1");
  });
});
