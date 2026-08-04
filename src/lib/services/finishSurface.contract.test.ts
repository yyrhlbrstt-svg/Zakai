import { describe, expect, it } from "vitest";
import { nextActionHref, rankNextAction } from "./nextAction";
import {
  pickShareableSavedCaseId,
  resolveMoneyFinishCaseId,
} from "./shareableSavedCase";
import { moneyPendingFeeHref, resolveMoneyPayFeeCaseId } from "./moneyPayFeeCase";
import { resolvePasteRecordField } from "./pasteRecordField";
import { isPendingSuccessFee } from "@/lib/pendingSuccessFee";

/**
 * Finish-surface contract: every open-loop kind — including fee — finishes on /money.
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

  it("routes success-fee collection to /money checkout only when payments live", () => {
    const action = rankNextAction([
      { id: "c1", status: "SAVED", fee: { amount: 1800, status: "PENDING" } },
    ]);
    expect(action.kind).toBe("pending_fee");
    expect(nextActionHref(action, { paymentsLive: true })).toBe(
      "/money?case=c1&payFee=1",
    );
    expect(nextActionHref(action, { paymentsLive: false })).toBe("/money?case=c1");
    expect(nextActionHref(action)).toBe("/money?case=c1");
  });

  it("dead ?case= pin never steals CaseNextStep from a live open loop", () => {
    expect(
      resolveMoneyFinishCaseId({
        cases: [
          { id: "dead", status: "REVOKED", savingsProof: null, fee: null },
          { id: "live", status: "SENT", savingsProof: null, fee: null },
        ],
        focusCaseId: "dead",
        rankedCaseId: "live",
      }),
    ).toBe("live");
  });

  it("payFee focus only mounts checkout when PENDING fee has ACTIVE Mandate", () => {
    expect(
      resolveMoneyPayFeeCaseId({
        payFee: true,
        focusCaseId: "paid",
        cases: [
          {
            id: "paid",
            fee: { amount: 900, status: "PAID" },
            authorization: { status: "ACTIVE" },
          },
          {
            id: "pending",
            fee: { amount: 18, status: "PENDING" },
            authorization: { status: "ACTIVE" },
          },
        ],
      }),
    ).toBe("pending");
  });

  it("payFee does not auto-mount when PENDING fee Mandate is inactive", () => {
    expect(
      resolveMoneyPayFeeCaseId({
        payFee: true,
        focusCaseId: "stuck",
        cases: [
          {
            id: "stuck",
            fee: { amount: 1800, status: "PENDING" },
            authorization: { status: "REVOKED" },
          },
        ],
      }),
    ).toBeNull();
  });

  it("post-settle href invents payFee only when Mandate active and payments live", () => {
    expect(
      moneyPendingFeeHref({ caseId: "c1", mandateActive: true, paymentsLive: true }),
    ).toBe("/money?case=c1&payFee=1");
    expect(
      moneyPendingFeeHref({ caseId: "c1", mandateActive: true, paymentsLive: false }),
    ).toBe("/money?case=c1");
    expect(
      moneyPendingFeeHref({ caseId: "c1", mandateActive: false, paymentsLive: true }),
    ).toBe("/money?case=c1");
  });

  it("sub-₪1 PENDING fee blocks share picker and stays collectible", () => {
    const fee = { amount: 18, status: "PENDING" };
    expect(isPendingSuccessFee(fee)).toBe(true);
    expect(
      pickShareableSavedCaseId([
        {
          id: "tiny",
          status: "SAVED",
          savingsProof: { savingMonthly: 100, selfReported: false },
          fee,
        },
      ]),
    ).toBeNull();
  });

  it("paste never one-taps raw extract without mapped recordAmount", () => {
    expect(
      resolvePasteRecordField({
        proposed: null,
        recordAmountShekels: null,
        extract: { newAmountShekels: 1200 },
      }).kind,
    ).toBe("none");
  });
});
