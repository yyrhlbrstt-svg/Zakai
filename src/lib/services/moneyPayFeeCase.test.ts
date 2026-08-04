import { describe, expect, it } from "vitest";
import { moneyPendingFeeHref, resolveMoneyPayFeeCaseId } from "./moneyPayFeeCase";

describe("resolveMoneyPayFeeCaseId", () => {
  const cases = [
    {
      id: "share",
      fee: { amount: 700, status: "PAID" as const },
      authorization: { status: "ACTIVE" as const },
    },
    {
      id: "tiny",
      fee: { amount: 18, status: "PENDING" as const },
      authorization: { status: "ACTIVE" as const },
    },
    {
      id: "big",
      fee: { amount: 1800, status: "PENDING" as const },
      authorization: { status: "ACTIVE" as const },
    },
  ];

  it("uses focused case when it has PENDING fee and ACTIVE Mandate", () => {
    expect(
      resolveMoneyPayFeeCaseId({ payFee: true, focusCaseId: "big", cases }),
    ).toBe("big");
  });

  it("falls back to first collectible PENDING when focus has no fee", () => {
    expect(
      resolveMoneyPayFeeCaseId({ payFee: true, focusCaseId: "share", cases }),
    ).toBe("tiny");
  });

  it("returns null when nothing pending", () => {
    expect(
      resolveMoneyPayFeeCaseId({
        payFee: true,
        focusCaseId: "share",
        cases: [
          {
            id: "share",
            fee: { amount: 700, status: "PAID" },
            authorization: { status: "ACTIVE" },
          },
        ],
      }),
    ).toBeNull();
  });

  it("returns null when PENDING fee has inactive Mandate", () => {
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

  it("skips inactive PENDING and picks an ACTIVE collectible case", () => {
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
          {
            id: "ok",
            fee: { amount: 900, status: "PENDING" },
            authorization: { status: "ACTIVE" },
          },
        ],
      }),
    ).toBe("ok");
  });
});

describe("moneyPendingFeeHref", () => {
  it("adds payFee only when Mandate is ACTIVE and payments are live", () => {
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
});
