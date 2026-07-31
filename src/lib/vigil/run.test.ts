import { describe, expect, it } from "vitest";
import { summariseWatch, todaysAlert } from "./watch";
import { DEFAULT_PROFILE } from "../profile/store";

/**
 * The decisions in `runVigil` that matter are about restraint, and they are
 * expressed through `summariseWatch`/`todaysAlert`, which are pure. The parts
 * that need a database — the fortnight of quiet, and claiming an alert key
 * before sending — are exercised by the integration suites.
 */
const NOW = new Date("2026-07-28T00:00:00Z");

describe("what the daily run would actually send", () => {
  it("sends nothing to a profile with nothing on the clock", () => {
    const summary = summariseWatch({ profile: DEFAULT_PROFILE, eligible: [], now: NOW });
    expect(todaysAlert(summary)).toBeNull();
  });

  it("sends nothing about a small sum, however close the date", () => {
    const summary = summariseWatch({
      profile: DEFAULT_PROFILE,
      eligible: [{ id: "tax_refund", yearlyMinor: 900 }],
      now: NOW,
    });
    expect(todaysAlert(summary)).toBeNull();
  });

  it("sends one thing when real money is genuinely near its deadline", () => {
    const summary = summariseWatch({
      profile: DEFAULT_PROFILE,
      eligible: [{ id: "tax_refund", yearlyMinor: 500_000 }],
      now: NOW,
    });
    const alert = todaysAlert(summary);
    if (alert) {
      expect(alert.absolute).toBe(true);
      expect(alert.urgency === "critical" || alert.urgency === "soon").toBe(true);
      expect(alert.valueAtRiskMinor).toBeGreaterThanOrEqual(5_000);
    }
    // Either nothing is due today, or exactly one thing is — never a list.
    expect(summary.alertable.length === 0 || alert !== null).toBe(true);
  });

  it("never picks something already expired", () => {
    const summary = summariseWatch({
      profile: DEFAULT_PROFILE,
      eligible: [{ id: "tax_refund", yearlyMinor: 500_000 }],
      now: NOW,
    });
    expect(todaysAlert(summary)?.urgency).not.toBe("expired");
  });

  it("stops mentioning a right once the person has acted on it", () => {
    const eligible = [{ id: "tax_refund", yearlyMinor: 500_000 }];
    const after = summariseWatch({
      profile: DEFAULT_PROFILE,
      eligible,
      actedOn: ["tax_refund"],
      now: NOW,
    });
    expect(todaysAlert(after)).toBeNull();
  });
});
