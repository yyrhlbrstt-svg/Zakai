import { describe, expect, it } from "vitest";
import { scanStatement } from "./subscriptions";
import { gateScanCharges } from "./scanClaims";
import { UNIVERSAL_CANCEL_DEMO_CSV } from "./subscriptionsDemoSample";

/**
 * The demo is most people's first contact with the product, and its button
 * names both merchants out loud. A gate that silently held one of them back
 * would make the first thing a stranger ever sees half-deliver its own
 * promise — so the demo has to keep clearing the gate on its own merits, and
 * this test fails if it stops.
 */
describe("the built-in demo", () => {
  it("produces a real claim for every merchant its button names", () => {
    const { recurring } = scanStatement(UNIVERSAL_CANCEL_DEMO_CSV);
    const { claimable, heldBack } = gateScanCharges(recurring);
    const named = claimable.map((c) => c.merchant).join(" ");
    expect(named).toContain("סלקום");
    expect(named).toContain("נטפליקס");
    expect(heldBack).toEqual([]);
  });

  it("clears the gate on evidence, not on a lowered bar", () => {
    // If this demo ever passes with two sightings of something, the gate has
    // been loosened rather than the fixture corrected.
    const { recurring } = scanStatement(UNIVERSAL_CANCEL_DEMO_CSV);
    for (const charge of recurring) {
      expect(charge.occurrences).toBeGreaterThanOrEqual(3);
    }
  });
});
