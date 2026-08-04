import { describe, it, expect } from "vitest";
import {
  aggregateCompanyStats,
  aggregateProviderVerticalStats,
  aggregateActivePressure,
  MIN_SAMPLE,
  type CaseOutcome,
  type VerticalCaseOutcome,
  type ActivePressureRow,
} from "./companyScore";

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

function makeVertical(
  provider: string,
  vertical: string,
  n: number,
  savedEach: number,
  savingAgorot: number,
): VerticalCaseOutcome[] {
  return Array.from({ length: n }, (_, i) => ({
    provider,
    vertical,
    saved: i < savedEach,
    savingAgorot: i < savedEach ? savingAgorot : 0,
  }));
}

describe("aggregateProviderVerticalStats", () => {
  it("excludes a vertical below the sample gate even when the provider total clears it", () => {
    // 5 cases total for "cellcom", but split 4/1 across two verticals — neither
    // vertical alone clears MIN_SAMPLE, so both must be excluded even though
    // aggregateCompanyStats would admit the provider as a whole.
    const outcomes = [
      ...makeVertical("cellcom", "telecom", 4, 3, 5000),
      ...makeVertical("cellcom", "parking", 1, 1, 5000),
    ];
    expect(aggregateProviderVerticalStats("cellcom", outcomes)).toEqual([]);
  });

  it("includes a vertical that clears the gate, with correct facts", () => {
    const outcomes = makeVertical("partner", "telecom", 5, 4, 5000);
    const stats = aggregateProviderVerticalStats("partner", outcomes);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toEqual({
      vertical: "telecom",
      cases: 5,
      savedCases: 4,
      savedRatePct: 80,
      avgSavingAgorot: 5000,
    });
  });

  it("only aggregates outcomes for the requested provider", () => {
    const outcomes = [
      ...makeVertical("bezeq", "telecom", 5, 5, 10000),
      ...makeVertical("partner", "telecom", 5, 5, 99999),
    ];
    const stats = aggregateProviderVerticalStats("bezeq", outcomes);
    expect(stats).toHaveLength(1);
    expect(stats[0].avgSavingAgorot).toBe(10000);
  });

  it("sorts verticals by case volume, most cases first", () => {
    const outcomes = [
      ...makeVertical("cellcom", "telecom", 6, 6, 5000),
      ...makeVertical("cellcom", "parking", 9, 9, 3000),
    ];
    const stats = aggregateProviderVerticalStats("cellcom", outcomes);
    expect(stats.map((s) => s.vertical)).toEqual(["parking", "telecom"]);
  });

  it("returns empty for no input", () => {
    expect(aggregateProviderVerticalStats("anyone", [])).toEqual([]);
  });
});

function makeActive(provider: string, n: number, status = "SENT"): ActivePressureRow[] {
  return Array.from({ length: n }, () => ({ provider, status }));
}

describe("aggregateActivePressure", () => {
  it("excludes providers below MIN_SAMPLE — same defamation gate as scores", () => {
    const rows = makeActive("cellcom", MIN_SAMPLE - 1);
    expect(aggregateActivePressure(rows)).toEqual([]);
  });

  it("counts a provider at or above MIN_SAMPLE", () => {
    const rows = makeActive("cellcom", MIN_SAMPLE);
    const stats = aggregateActivePressure(rows);
    expect(stats).toEqual([{ provider: "cellcom", activeCases: MIN_SAMPLE }]);
  });

  it("only counts open statuses — resolved cases are not 'currently pursuing'", () => {
    const rows = [
      ...makeActive("cellcom", MIN_SAMPLE, "SENT"),
      ...makeActive("cellcom", 20, "SAVED"),
      ...makeActive("cellcom", 20, "NO_SAVING"),
    ];
    const stats = aggregateActivePressure(rows);
    expect(stats).toEqual([{ provider: "cellcom", activeCases: MIN_SAMPLE }]);
  });

  it("covers every open status, not just SENT", () => {
    const rows: ActivePressureRow[] = [
      ...makeActive("bank-leumi", 2, "ANALYZED"),
      ...makeActive("bank-leumi", 2, "APPROVED"),
      ...makeActive("bank-leumi", 1, "VERIFIED"),
    ];
    const stats = aggregateActivePressure(rows);
    expect(stats).toEqual([{ provider: "bank-leumi", activeCases: 5 }]);
  });

  it("sorts providers by active-case volume, most pressure first", () => {
    const rows = [...makeActive("cellcom", 6), ...makeActive("bank-leumi", 9)];
    const stats = aggregateActivePressure(rows);
    expect(stats.map((s) => s.provider)).toEqual(["bank-leumi", "cellcom"]);
  });

  it("returns empty for no input", () => {
    expect(aggregateActivePressure([])).toEqual([]);
  });
});
