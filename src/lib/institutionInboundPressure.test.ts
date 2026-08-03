import { describe, expect, it } from "vitest";
import { aggregateInboundPressure } from "./institutionInboundPressure";

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
