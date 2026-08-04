import { describe, expect, it } from "vitest";
import { extractShekelAmountFromText } from "./extractShekelAmount";

describe("extractShekelAmountFromText", () => {
  it("reads ₪ amounts", () => {
    const r = extractShekelAmountFromText("המחיר החדש הוא ₪89 לחודש", {
      originalShekels: 120,
    });
    expect(r?.shekels).toBe(89);
  });

  it("reads Hebrew shekel suffix", () => {
    const r = extractShekelAmountFromText("יתרה לתשלום: 240 ש\"ח", { originalShekels: 400 });
    expect(r?.shekels).toBe(240);
  });

  it("prefers amount near original when several exist", () => {
    const r = extractShekelAmountFromText("הצעה ₪1 או ₪99", { originalShekels: 120 });
    expect(r?.shekels).toBe(99);
  });

  it("returns null on empty-ish text", () => {
    expect(extractShekelAmountFromText("ok")).toBeNull();
  });
});
