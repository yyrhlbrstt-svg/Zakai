import { describe, expect, it } from "vitest";
import { toVisualRtl, toVisualIfRtl } from "./ogBidi";

describe("toVisualRtl — logical to Satori visual order", () => {
  it("mirrors a pure-Hebrew phrase (full-string reversal)", () => {
    // Visual order of an all-RTL line drawn LTR is the exact mirror.
    expect(toVisualRtl("זכאי")).toBe("יאכז");
    expect(toVisualRtl("אב גד")).toBe("דג בא");
  });

  it("round-trips: applying twice restores the original", () => {
    const s = "בודקים כמה מגיע לכם — בחינם";
    expect(toVisualRtl(toVisualRtl(s))).toBe(s);
  });

  it("keeps digits and currency intact while mirroring the Hebrew around them", () => {
    // "שילמתם 320 ₪" — the number must stay "320", not become "023".
    const visual = toVisualRtl("שילמתם 320 בשנה");
    expect(visual).toContain("320");
    expect(visual).not.toContain("023");
    // Hebrew words are individually reversed and the order mirrored.
    expect(visual.startsWith("הנשב")).toBe(true);
    expect(visual.endsWith("םתמליש")).toBe(true);
  });

  it("leaves a pure-LTR string untouched", () => {
    expect(toVisualRtl("₪2,390")).toBe("₪2,390");
    expect(toVisualIfRtl("zakai-3uxj.vercel.app")).toBe("zakai-3uxj.vercel.app");
  });

  it("toVisualIfRtl converts only strings that contain RTL script", () => {
    expect(toVisualIfRtl("זכאי")).toBe("יאכז");
    expect(toVisualIfRtl("Zakai")).toBe("Zakai");
    expect(toVisualIfRtl("")).toBe("");
  });
});
