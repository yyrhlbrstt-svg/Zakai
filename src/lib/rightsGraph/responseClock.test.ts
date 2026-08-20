import { describe, expect, it } from "vitest";
import { computeResponseClock, ESCALATION_RUNG_HE } from "./responseClock";

const SENT = new Date("2026-08-01T10:00:00Z");
const day = (n: number) => new Date(SENT.getTime() + n * 24 * 60 * 60 * 1000);

describe("computeResponseClock", () => {
  it("computes the window from the graph's responseDeadlineDays (14 for the 31a right)", () => {
    const clock = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 1,
      now: day(3),
    });
    expect(clock).not.toBeNull();
    expect(clock!.deadlineDays).toBe(14);
    expect(clock!.expiresAt.getTime()).toBe(day(14).getTime());
    expect(clock!.expired).toBe(false);
    expect(clock!.daysRemaining).toBe(11);
    expect(clock!.daysOverdue).toBe(0);
  });

  it("flips to expired exactly at the deadline and counts days overdue", () => {
    const atDeadline = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 1,
      now: day(14),
    });
    expect(atDeadline!.expired).toBe(true);
    expect(atDeadline!.daysRemaining).toBe(0);

    const overdue = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 1,
      now: day(20),
    });
    expect(overdue!.expired).toBe(true);
    expect(overdue!.daysOverdue).toBe(6);
  });

  it("suggests the ladder's first rung after one demand, the second after two, clamped", () => {
    const one = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 1,
      now: day(15),
    });
    expect(one!.nextRung).toBe("followup_continued_billing");
    expect(one!.remainingLadder).toEqual([
      "followup_continued_billing",
      "regulator_complaint",
      "small_claims_package",
    ]);

    const two = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 2,
      now: day(15),
    });
    expect(two!.nextRung).toBe("regulator_complaint");

    const many = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 9,
      now: day(15),
    });
    // Clamped to the second rung — the clock never claims later rungs happened.
    expect(many!.nextRung).toBe("regulator_complaint");
  });

  it("labels every rung of the shipped ladder in Hebrew", () => {
    const clock = computeResponseClock({
      vertical: "subscription",
      lastDemandSentAt: SENT,
      demandsSent: 1,
    });
    for (const rung of clock!.remainingLadder) {
      expect(ESCALATION_RUNG_HE[rung], rung).toBeTruthy();
    }
  });

  it("returns null for unmapped verticals, zero demands, and invalid dates — never a fake clock", () => {
    expect(
      computeResponseClock({ vertical: "telecom", lastDemandSentAt: SENT, demandsSent: 1 }),
    ).toBeNull();
    expect(
      computeResponseClock({ vertical: "subscription", lastDemandSentAt: SENT, demandsSent: 0 }),
    ).toBeNull();
    expect(
      computeResponseClock({
        vertical: "subscription",
        lastDemandSentAt: new Date("not a date"),
        demandsSent: 1,
      }),
    ).toBeNull();
  });
});
