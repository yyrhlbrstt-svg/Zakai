import { describe, expect, it } from "vitest";
import { planRetentionActions } from "./retentionEngine";

describe("planRetentionActions", () => {
  it("prioritizes send over rescan", () => {
    const actions = planRetentionActions({
      daysSinceLastServerCase: 120,
      openAnalyzedOrApproved: 0,
      openVerifiedReadyToSend: 1,
      openSent: 0,
      savedWithoutRecentShare: false,
      householdBeneficiaryCases: 0,
      upcomingDeadlines: 0,
      openVigilAlerts: 0,
      hasAnySaved: false,
    });
    expect(actions[0]?.kind).toBe("complete_send");
  });

  it("suggests rescan when idle", () => {
    const actions = planRetentionActions({
      daysSinceLastServerCase: 100,
      openAnalyzedOrApproved: 0,
      openVerifiedReadyToSend: 0,
      openSent: 0,
      savedWithoutRecentShare: false,
      householdBeneficiaryCases: 0,
      upcomingDeadlines: 0,
      openVigilAlerts: 0,
      hasAnySaved: false,
    });
    expect(actions.some((a) => a.kind === "rescan")).toBe(true);
  });

  it("points household retention at /money not /check", () => {
    const actions = planRetentionActions({
      daysSinceLastServerCase: 10,
      openAnalyzedOrApproved: 0,
      openVerifiedReadyToSend: 0,
      openSent: 0,
      savedWithoutRecentShare: false,
      householdBeneficiaryCases: 0,
      upcomingDeadlines: 0,
      openVigilAlerts: 0,
      hasAnySaved: true,
    });
    const household = actions.find((a) => a.kind === "household");
    expect(household?.href).toContain("/money");
  });
});
