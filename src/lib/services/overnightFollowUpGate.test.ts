import { describe, expect, it } from "vitest";
import { isOvernightFollowUpDue } from "./overnightFollowUpGate";

describe("isOvernightFollowUpDue", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");

  it("refuses day-0 SENT (theater)", () => {
    expect(
      isOvernightFollowUpDue({
        updatedAt: new Date(now - 2 * 3_600_000),
        waitDays: 5,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("allows after the wait window", () => {
    expect(
      isOvernightFollowUpDue({
        updatedAt: new Date(now - 5 * 86_400_000),
        waitDays: 5,
        nowMs: now,
      }),
    ).toBe(true);
  });
});
