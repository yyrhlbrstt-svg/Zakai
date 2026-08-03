import { describe, expect, it } from "vitest";
import { resolveMoneyPayFeeCaseId } from "./moneyPayFeeCase";

describe("resolveMoneyPayFeeCaseId", () => {
  const cases = [
    {
      id: "share",
      fee: { amount: 700, status: "PAID" as const },
    },
    {
      id: "tiny",
      fee: { amount: 18, status: "PENDING" as const },
    },
    {
      id: "big",
      fee: { amount: 1800, status: "PENDING" as const },
    },
  ];

  it("uses focused case when it has PENDING fee", () => {
    expect(
      resolveMoneyPayFeeCaseId({ payFee: true, focusCaseId: "big", cases }),
    ).toBe("big");
  });

  it("falls back to first PENDING when focus has no fee", () => {
    expect(
      resolveMoneyPayFeeCaseId({ payFee: true, focusCaseId: "share", cases }),
    ).toBe("tiny");
  });

  it("returns null when nothing pending", () => {
    expect(
      resolveMoneyPayFeeCaseId({
        payFee: true,
        focusCaseId: "share",
        cases: [{ id: "share", fee: { amount: 700, status: "PAID" } }],
      }),
    ).toBeNull();
  });
});
