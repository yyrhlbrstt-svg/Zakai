import { describe, expect, it } from "vitest";
import { buildAirlineFollowUp } from "./flightNegotiation";

describe("buildAirlineFollowUp", () => {
  it("does not mention monthly plan retention", () => {
    const r = buildAirlineFollowUp({
      customerName: "Test",
      providerLabel: "EL AL",
      amountOriginalShekels: 1000,
      targetShekels: 0,
      replyKind: "delay",
      round: 2,
    });
    expect(r.body).toContain("פיצוי");
    expect(r.body).not.toContain("מסלול");
    expect(r.body).not.toContain("בחודש");
  });
});
