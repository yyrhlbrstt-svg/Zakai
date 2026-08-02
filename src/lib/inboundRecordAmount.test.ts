import { describe, expect, it } from "vitest";
import { resolveInboundRecordAmountShekels } from "@/lib/fee";

describe("inbound lump semantics (proof loop)", () => {
  it("treats explicit remaining balance as recordSaving input", () => {
    expect(resolveInboundRecordAmountShekels("lump", 5000, 1800, "remaining")).toBe(1800);
  });

  it("maps refund credits to remaining owed", () => {
    expect(resolveInboundRecordAmountShekels("lump", 5000, 5000, "refund")).toBe(0);
    expect(resolveInboundRecordAmountShekels("lump", 5000, 2000, "refund")).toBe(3000);
  });

  it("defaults lump unknown kind to refund mapping", () => {
    expect(resolveInboundRecordAmountShekels("lump", 1000, 400, null)).toBe(600);
  });
});
