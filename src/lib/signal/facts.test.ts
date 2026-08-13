import { describe, it, expect } from "vitest";
import { buildEligibilityFacts } from "@/lib/signal/facts";
import { checkEligibility } from "@/lib/signal/eligibility";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("what a rule is allowed to know about somebody", () => {
  it("collects providers and verticals from their cases", () => {
    const facts = buildEligibilityFacts({
      country: "il",
      cases: [
        { provider: "cellcom", vertical: "telecom", createdAt: d("2026-01-10"), updatedAt: d("2026-02-01") },
        { provider: "hapoalim", vertical: "bank-fees", createdAt: d("2025-06-01"), updatedAt: d("2025-07-01") },
      ],
    });
    expect(facts.country).toBe("IL");
    expect(facts.providers).toEqual(["cellcom", "hapoalim"]);
    expect(facts.verticals).toEqual(["bank-fees", "telecom"]);
  });

  it("keeps the window to what was actually observed", () => {
    // The whole honesty of this system. Somebody who opened a case in March
    // was probably a customer for years, and we do not know from when —
    // widening the window into that guess is what would start telling people
    // something untrue at scale.
    const facts = buildEligibilityFacts({
      country: "IL",
      cases: [
        { provider: "hapoalim", vertical: "bank-fees", createdAt: d("2026-03-01"), updatedAt: d("2026-03-20") },
      ],
    });
    expect(facts.providerWindows!.hapoalim).toEqual(["2026-03-01", "2026-03-20"]);

    // An event covering 2019–2024 must not match them on the strength of a
    // 2026 case, however likely it feels that they were a customer then.
    const result = checkEligibility(
      { kind: "hadProviderBetween", provider: "hapoalim", from: "2019-01-01", to: "2024-12-31" },
      facts,
    );
    expect(result.matched).toBe(false);
  });

  it("unions several sightings of the same relationship", () => {
    const facts = buildEligibilityFacts({
      country: "IL",
      cases: [
        { provider: "cellcom", vertical: "telecom", createdAt: d("2024-05-01"), updatedAt: d("2024-06-01") },
        { provider: "cellcom", vertical: "telecom", createdAt: d("2026-01-01"), updatedAt: d("2026-01-15") },
      ],
    });
    expect(facts.providerWindows!.cellcom).toEqual(["2024-05-01", "2026-01-15"]);
  });

  it("treats a detected charge as one day of evidence, not a month", () => {
    const facts = buildEligibilityFacts({
      country: "IL",
      cases: [],
      charges: [{ provider: "netflix", observedAt: d("2026-08-01") }],
    });
    expect(facts.providers).toEqual(["netflix"]);
    expect(facts.providerWindows!.netflix).toEqual(["2026-08-01", "2026-08-01"]);
  });

  it("answers 'we do not know' rather than guessing, for an undated provider", () => {
    const facts = buildEligibilityFacts({ country: "IL", cases: [], charges: [] });
    const withUndated = { ...facts, providers: ["mystery-bank"] };
    expect(
      checkEligibility({ kind: "hasProvider", provider: "mystery-bank" }, withUndated).matched,
    ).toBe(true);
    expect(
      checkEligibility(
        { kind: "hadProviderBetween", provider: "mystery-bank", from: "2020-01-01", to: "2026-01-01" },
        withUndated,
      ).matched,
    ).toBe(false);
  });

  it("orders a window whose dates arrive backwards", () => {
    // A clock problem, not a relationship that ran backwards. Emitting
    // ["2026-03-20", "2026-03-01"] would produce a window no date can fall
    // inside, silently excluding somebody who does qualify.
    const facts = buildEligibilityFacts({
      country: "IL",
      cases: [
        { provider: "x", vertical: "v", createdAt: d("2026-03-20"), updatedAt: d("2026-03-01") },
      ],
    });
    const [from, to] = facts.providerWindows!.x;
    expect(from <= to).toBe(true);
    expect(
      checkEligibility(
        { kind: "hadProviderBetween", provider: "x", from: "2026-03-05", to: "2026-03-10" },
        facts,
      ).matched,
    ).toBe(true);
  });

  it("carries nothing a rule has no business seeing", () => {
    const facts = buildEligibilityFacts({
      country: "IL",
      cases: [{ provider: "p", vertical: "v", createdAt: d("2026-01-01"), updatedAt: d("2026-01-02") }],
    });
    // Matching may run over many people at once. The blast radius of that is
    // exactly the size of this object.
    expect(Object.keys(facts).sort()).toEqual([
      "country",
      "providerWindows",
      "providers",
      "verticals",
    ]);
  });
});
