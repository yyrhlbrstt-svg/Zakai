import { describe, expect, it } from "vitest";
import {
  aggregateInboundPressure,
  aggregateInboundPressureTrend,
  TREND_WINDOW_DAYS,
  type InboundPressureDatedRow,
} from "./institutionInboundPressure";

describe("aggregateInboundPressure", () => {
  it("counts only outbound statuses for mapped providers", () => {
    const stats = aggregateInboundPressure([
      { provider: "leumi", status: "SENT" },
      { provider: "leumi", status: "SAVED" },
      { provider: "leumi", status: "ANALYZED" },
      { provider: "cellcom", status: "SENT" },
    ]);
    const leumi = stats.find((s) => s.institutionId === "bank-leumi");
    expect(leumi?.dispatchedCases).toBe(2);
    expect(leumi?.savedCases).toBe(1);
    expect(leumi?.disclosed).toBe(false);

    const cellcom = stats.find((s) => s.institutionId === "cellcom");
    expect(cellcom?.dispatchedCases).toBe(1);
    expect(cellcom?.savedCases).toBe(0);
  });

  it("maps electricity providers to iec pressure", () => {
    const stats = aggregateInboundPressure([
      { provider: "iec", status: "SENT" },
      { provider: "חברת החשמל", status: "SAVED" },
    ]);
    const iec = stats.find((s) => s.institutionId === "iec");
    expect(iec?.dispatchedCases).toBe(2);
    expect(iec?.savedCases).toBe(1);
  });

  it("marks disclosed at MIN_SAMPLE dispatched", () => {
    const rows = Array.from({ length: 5 }, () => ({
      provider: "hapoalim",
      status: "SENT",
    }));
    const stats = aggregateInboundPressure(rows);
    expect(stats[0]?.institutionId).toBe("bank-hapoalim");
    expect(stats[0]?.disclosed).toBe(true);
  });

  it("prefers mandateAudience over unmapped provider text", () => {
    const stats = aggregateInboundPressure([
      { provider: "בנק לאומי", status: "SENT", mandateAudience: "bank-leumi" },
    ]);
    expect(stats[0]?.institutionId).toBe("bank-leumi");
  });
});

const NOW = new Date("2026-08-05T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS);
}

function row(provider: string, daysBack: number, status = "SENT"): InboundPressureDatedRow {
  return { provider, status, createdAt: daysAgo(daysBack) };
}

describe("aggregateInboundPressureTrend", () => {
  it("excludes an institution below MIN_SAMPLE total across both windows", () => {
    const rows = [row("hapoalim", 5), row("hapoalim", 10), row("hapoalim", 40)];
    expect(aggregateInboundPressureTrend(rows, NOW)).toEqual([]);
  });

  it("splits volume into the recent and prior windows correctly", () => {
    const rows = [
      // recent window (0-30 days ago): 3 cases
      row("hapoalim", 1),
      row("hapoalim", 10),
      row("hapoalim", 20),
      // prior window (30-60 days ago): 2 cases
      row("hapoalim", 35),
      row("hapoalim", 45),
    ];
    const trends = aggregateInboundPressureTrend(rows, NOW);
    expect(trends).toEqual([
      {
        institutionId: "bank-hapoalim",
        recentWindowCases: 3,
        priorWindowCases: 2,
        changePct: 50,
      },
    ]);
  });

  it("reports changePct as null rather than a fabricated ratio when the prior window is empty", () => {
    const rows = [row("hapoalim", 1), row("hapoalim", 2), row("hapoalim", 3), row("hapoalim", 4), row("hapoalim", 5)];
    const trends = aggregateInboundPressureTrend(rows, NOW);
    expect(trends[0].priorWindowCases).toBe(0);
    expect(trends[0].changePct).toBeNull();
  });

  it("excludes rows older than the two-window range and future rows", () => {
    const rows = [
      row("hapoalim", 1),
      row("hapoalim", 2),
      row("hapoalim", 3),
      row("hapoalim", 4),
      row("hapoalim", 5),
      row("hapoalim", TREND_WINDOW_DAYS * 2 + 10), // too old — excluded
    ];
    const trends = aggregateInboundPressureTrend(rows, NOW);
    expect(trends[0].recentWindowCases + trends[0].priorWindowCases).toBe(5);
  });

  it("sorts by recent-window volume, most pressure first", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row("hapoalim", 1)),
      ...Array.from({ length: 8 }, () => row("leumi", 1)),
    ];
    const trends = aggregateInboundPressureTrend(rows, NOW);
    expect(trends.map((t) => t.institutionId)).toEqual(["bank-leumi", "bank-hapoalim"]);
  });

  it("returns empty for no input", () => {
    expect(aggregateInboundPressureTrend([], NOW)).toEqual([]);
  });
});
