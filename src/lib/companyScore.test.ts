import { describe, it, expect } from "vitest";
import { aggregateCompanyStats, MIN_SAMPLE, type CaseOutcome } from "./companyScore";

function make(provider: string, n: number, savedEach: number, savingAgorot: number): CaseOutcome[] {
  return Array.from({ length: n }, (_, i) => ({
    provider,
    saved: i < savedEach,
    savingAgorot: i < savedEach ? savingAgorot : 0,
  }));
}

describe("aggregateCompanyStats", () => {
  it("excludes providers below the sample gate (defamation safeguard)", () => {
    const stats = aggregateCompanyStats(make("cellcom", MIN_SAMPLE - 1, 2, 5000));
    expect(stats).toHaveLength(0);
  });

  it("includes a provider that clears the gate, with correct facts", () => {
    // 5 cases, 4 saved, ₪50 each.
    const stats = aggregateCompanyStats(make("partner", 5, 4, 5000));
    expect(stats).toHaveLength(1);
    const s = stats[0];
    expect(s.provider).toBe("partner");
    expect(s.cases).toBe(5);
    expect(s.savedCases).toBe(4);
    expect(s.savedRatePct).toBe(80);
    expect(s.avgSavingAgorot).toBe(5000);
  });

  it("averages only over cases that actually saved", () => {
    // 6 cases, 3 saved at ₪100, ₪200, ₪300 -> avg ₪200 (20000 agorot).
    const outcomes: CaseOutcome[] = [
      { provider: "bezeq", saved: true, savingAgorot: 10000 },
      { provider: "bezeq", saved: true, savingAgorot: 20000 },
      { provider: "bezeq", saved: true, savingAgorot: 30000 },
      { provider: "bezeq", saved: false, savingAgorot: 0 },
      { provider: "bezeq", saved: false, savingAgorot: 0 },
      { provider: "bezeq", saved: false, savingAgorot: 0 },
    ];
    const s = aggregateCompanyStats(outcomes)[0];
    expect(s.avgSavingAgorot).toBe(20000);
    expect(s.savedRatePct).toBe(50);
  });

  it("sorts providers by average saving, most impactful first", () => {
    const stats = aggregateCompanyStats([
      ...make("low", 5, 5, 3000),
      ...make("high", 5, 5, 9000),
    ]);
    expect(stats.map((s) => s.provider)).toEqual(["high", "low"]);
  });

  it("handles a provider that cleared the gate but never saved", () => {
    const s = aggregateCompanyStats(make("nosave", 5, 0, 0))[0];
    expect(s.savedCases).toBe(0);
    expect(s.avgSavingAgorot).toBe(0);
    expect(s.savedRatePct).toBe(0);
  });

  it("returns empty for no input", () => {
    expect(aggregateCompanyStats([])).toEqual([]);
  });
});
