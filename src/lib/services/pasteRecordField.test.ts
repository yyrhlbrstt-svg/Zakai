import { describe, expect, it } from "vitest";
import { resolvePasteRecordField } from "./pasteRecordField";

describe("resolvePasteRecordField", () => {
  it("prefers proposed for one-tap", () => {
    expect(
      resolvePasteRecordField({
        proposed: { newAmountShekels: 80, confidence: 0.9 },
        recordAmountShekels: 80,
        extract: { newAmountShekels: 80 },
      }),
    ).toEqual({ kind: "proposed", newAmountShekels: 80, confidence: 0.9 });
  });

  it("uses mapped recordAmount when no proposal", () => {
    expect(
      resolvePasteRecordField({
        proposed: null,
        recordAmountShekels: 3800,
        extract: { newAmountShekels: 1200 },
      }),
    ).toEqual({ kind: "mapped", newAmountShekels: 3800 });
  });

  it("rejects raw extract-only (never fabricate remaining from refund)", () => {
    expect(
      resolvePasteRecordField({
        proposed: null,
        recordAmountShekels: null,
        extract: { newAmountShekels: 1200 },
      }),
    ).toEqual({ kind: "none" });
  });
});
