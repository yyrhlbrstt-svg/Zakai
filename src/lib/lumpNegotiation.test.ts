import { describe, expect, it } from "vitest";
import { buildLumpFollowUp } from "./lumpNegotiation";

describe("buildLumpFollowUp", () => {
  it("asks for written confirmation on accepted", () => {
    const r = buildLumpFollowUp({
      customerName: "יוסי",
      providerLabel: "בנק",
      amountOriginalShekels: 500,
      targetShekels: 0,
      replyKind: "accepted",
    });
    expect(r.body).toMatch(/אישור כתוב/);
    expect(r.body).not.toMatch(/לחודש/);
  });
});
