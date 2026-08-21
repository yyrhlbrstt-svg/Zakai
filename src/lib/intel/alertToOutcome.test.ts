import { describe, expect, it } from "vitest";
import { computeAlertToOutcome, readAlertHealth } from "./alertToOutcome";
import { MIN_SAMPLE } from "@/lib/companyScore";

const counts = (surfaced: number, cases: number, proved: number, provedAgorot = 0) =>
  computeAlertToOutcome({ surfaced, cases, proved, provedAgorot });

describe("alert-to-outcome", () => {
  it("withholds every ratio below the sample floor rather than printing noise", () => {
    const m = counts(3, 1, 1);
    expect(m.surfacedToCase).toBeNull();
    expect(m.caseToProved).toBeNull();
    expect(m.surfacedToProved).toBeNull();
    expect(m.belowSample).toBe(true);
    // The counts themselves are still true and still reported.
    expect(m.surfaced).toBe(3);
  });

  it("does not let a null ratio be mistaken for a zero one", () => {
    const nothingYet = counts(0, 0, 0);
    expect(nothingYet.surfacedToCase).toBeNull();
    expect(nothingYet.belowSample).toBe(true);
    expect(readAlertHealth(nothingYet)).toBe("unknown");
  });

  it("reports the two ratios separately, because they fail differently", () => {
    // Everybody acted, almost nobody was actually owed anything: the shape of
    // "very persuasive, frequently wrong".
    const persuasiveAndWrong = counts(20, 18, 1, 5_000);
    expect(persuasiveAndWrong.surfacedToCase).toBeGreaterThan(0.8);
    expect(persuasiveAndWrong.caseToProved).toBeLessThan(0.1);
    expect(readAlertHealth(persuasiveAndWrong)).toBe("investigate");

    // Nobody acted, but everyone who did was right: a product problem, not a
    // truthfulness one. Still worth investigating, for a different reason.
    const trueButIgnored = counts(200, 8, 7, 500_000);
    expect(trueButIgnored.caseToProved).toBeGreaterThan(0.8);
    expect(trueButIgnored.surfacedToCase).toBeLessThan(0.1);
    expect(readAlertHealth(trueButIgnored)).toBe("investigate");
  });

  it("calls a working funnel healthy", () => {
    const m = counts(40, 20, 12, 1_200_000);
    expect(m.surfacedToCase).toBe(0.5);
    expect(m.caseToProved).toBe(0.6);
    expect(readAlertHealth(m)).toBe("healthy");
  });

  it("starts reporting exactly at the sample floor, not before", () => {
    expect(counts(MIN_SAMPLE - 1, MIN_SAMPLE - 1, 1).surfacedToCase).toBeNull();
    expect(counts(MIN_SAMPLE, MIN_SAMPLE, 1).surfacedToCase).not.toBeNull();
  });

  it("cannot be pushed above 1 or below 0 by dirty counts", () => {
    const m = counts(-5, -2, -1, -100);
    expect(m.surfaced).toBe(0);
    expect(m.cases).toBe(0);
    expect(m.proved).toBe(0);
    expect(m.provedAgorot).toBe(0);
  });

  it("keeps money in integer agorot", () => {
    expect(counts(10, 10, 5, 12_345.9).provedAgorot).toBe(12_345);
  });
});
