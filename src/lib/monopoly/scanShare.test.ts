import { describe, expect, it } from "vitest";
import { buildScanShareMessage, scanShareKicker } from "./scanShare";

describe("scanShare", () => {
  it("does not claim documented savings", () => {
    const msg = buildScanShareMessage("he", { amountLabel: "₪144", recurringCount: 2 });
    expect(msg).toContain("זיהיתי");
    expect(msg).not.toContain("חסכתי");
  });

  it("english kicker", () => {
    expect(scanShareKicker("en")).toBe("Recurring charge scan");
  });
});
