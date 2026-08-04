import { describe, expect, it } from "vitest";
import {
  isDeadFinishStatus,
  pickShareableSavedCaseId,
  resolveMoneyFinishCaseId,
} from "./shareableSavedCase";

describe("isDeadFinishStatus", () => {
  it("marks NO_SAVING and REVOKED as dead finish pins", () => {
    expect(isDeadFinishStatus("NO_SAVING")).toBe(true);
    expect(isDeadFinishStatus("REVOKED")).toBe(true);
    expect(isDeadFinishStatus("SENT")).toBe(false);
    expect(isDeadFinishStatus("SAVED")).toBe(false);
  });
});

describe("pickShareableSavedCaseId", () => {
  it("returns documented SAVED even when success fee is still PENDING", () => {
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
    ).toBe("pending");
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

  it("treats sub-₪1 PENDING fee as still shareable (virality unlocked)", () => {
    expect(
      pickShareableSavedCaseId([
        {
          id: "tiny-fee",
          status: "SAVED",
          savingsProof: { savingMonthly: 100, selfReported: false },
          fee: { amount: 18, status: "PENDING" },
        },
      ]),
    ).toBe("tiny-fee");
  });
});

describe("resolveMoneyFinishCaseId", () => {
  const cases = [
    {
      id: "dead",
      status: "NO_SAVING",
      savingsProof: null,
      fee: null,
    },
    {
      id: "sent",
      status: "SENT",
      savingsProof: null,
      fee: null,
    },
    {
      id: "share",
      status: "SAVED",
      savingsProof: { savingMonthly: 4000, selfReported: false },
      fee: { amount: 700, status: "PAID" },
    },
  ];

  it("prefers live ranked open loop over a dead ?case= pin", () => {
    expect(
      resolveMoneyFinishCaseId({
        cases,
        focusCaseId: "dead",
        rankedCaseId: "sent",
      }),
    ).toBe("sent");
  });

  it("keeps a live focused case even when ranked differs", () => {
    expect(
      resolveMoneyFinishCaseId({
        cases,
        focusCaseId: "share",
        rankedCaseId: "sent",
      }),
    ).toBe("share");
  });

  it("shows dead finish when there is no open loop", () => {
    expect(
      resolveMoneyFinishCaseId({
        cases,
        focusCaseId: "dead",
        rankedCaseId: null,
      }),
    ).toBe("dead");
  });

  it("falls back to shareable SAVED after start_money", () => {
    expect(
      resolveMoneyFinishCaseId({
        cases,
        focusCaseId: null,
        rankedCaseId: null,
      }),
    ).toBe("share");
  });

  it("uses ranked open loop when no focus", () => {
    expect(
      resolveMoneyFinishCaseId({
        cases,
        focusCaseId: null,
        rankedCaseId: "sent",
      }),
    ).toBe("sent");
  });
});
