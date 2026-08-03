import { describe, expect, it } from "vitest";
import { isDeadFinishStatus, pickShareableSavedCaseId } from "./shareableSavedCase";

describe("isDeadFinishStatus", () => {
  it("marks NO_SAVING and REVOKED as dead finish pins", () => {
    expect(isDeadFinishStatus("NO_SAVING")).toBe(true);
    expect(isDeadFinishStatus("REVOKED")).toBe(true);
    expect(isDeadFinishStatus("SENT")).toBe(false);
    expect(isDeadFinishStatus("SAVED")).toBe(false);
  });
});

describe("pickShareableSavedCaseId", () => {
  it("returns newest documented SAVED without pending fee", () => {
    expect(
      pickShareableSavedCaseId([
        {
          id: "pending",
          status: "SAVED",
          savingsProof: { savingMonthly: 5000, selfReported: false },
          fee: { amount: 900, status: "PENDING" },
        },
        {
          id: "share",
          status: "SAVED",
          savingsProof: { savingMonthly: 4000, selfReported: false },
          fee: { amount: 700, status: "PAID" },
        },
      ]),
    ).toBe("share");
  });

  it("skips self-reported and non-SAVED", () => {
    expect(
      pickShareableSavedCaseId([
        {
          id: "self",
          status: "SAVED",
          savingsProof: { savingMonthly: 4000, selfReported: true },
          fee: null,
        },
        { id: "sent", status: "SENT", savingsProof: null, fee: null },
      ]),
    ).toBeNull();
  });

  it("allows zero-fee SAVED with real proof", () => {
    expect(
      pickShareableSavedCaseId([
        {
          id: "waived",
          status: "SAVED",
          savingsProof: { savingMonthly: 2000, selfReported: false },
          fee: null,
        },
      ]),
    ).toBe("waived");
  });
});
