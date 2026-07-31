import { describe, expect, it } from "vitest";
import { applyStance, stanceAffects, type Letter } from "./applyStance";
import { VARIANTS, variantById } from "./variants";

const letter: Letter = {
  subject: "בקשה להחזר עמלה",
  body: "לכבוד\nבנק לדוגמה\n\nאבקש לבחון את העמלות שנגבו מחשבוני.\n\nבכבוד רב,\nדנה כהן",
};

describe("the stance genuinely changes what is sent", () => {
  it("moves the letter for every declared variant", () => {
    // If any stance were a no-op, attributing an outcome to it would be
    // recording evidence about a letter that never differed.
    for (const v of VARIANTS) {
      expect({ id: v.id, affects: stanceAffects(letter, v) }).toEqual({ id: v.id, affects: true });
    }
  });

  it("produces a different letter for different stances", () => {
    const bodies = new Set(VARIANTS.map((v) => applyStance(letter, v).body));
    expect(bodies.size).toBeGreaterThan(3);
  });

  it("is pure — the same input always yields the same letter", () => {
    const v = variantById("firm_statutory")!;
    expect(applyStance(letter, v)).toEqual(applyStance(letter, v));
  });
});

describe("it only adds, never rewrites the substance", () => {
  it("keeps the original body intact inside the result", () => {
    for (const v of VARIANTS) {
      const out = applyStance(letter, v);
      expect(out.body).toContain("אבקש לבחון את העמלות שנגבו מחשבוני.");
      expect(out.subject).toBe(letter.subject);
    }
  });

  it("keeps the sign-off last", () => {
    for (const v of VARIANTS) {
      const out = applyStance(letter, v);
      const afterSignOff = out.body.slice(out.body.lastIndexOf("בכבוד רב"));
      expect(afterSignOff.trim()).toBe("בכבוד רב,\nדנה כהן");
    }
  });

  it("appends cleanly when there is no sign-off to insert before", () => {
    const bare: Letter = { subject: "s", body: "גוף המכתב." };
    const out = applyStance(bare, variantById("formal_escalation")!);
    expect(out.body.startsWith("גוף המכתב.")).toBe(true);
    expect(out.body.length).toBeGreaterThan(bare.body.length);
  });
});

describe("it does not repeat what the builder already said", () => {
  it("adds no second statutory assertion when one is already cited", () => {
    const cited: Letter = {
      subject: "s",
      body: "לפי סעיף 13ד לחוק הגנת הצרכן, אבקש החזר.\n\nבכבוד רב,\nא",
    };
    const out = applyStance(cited, variantById("firm_statutory")!);
    // A vague second claim of legal basis beside a specific citation weakens it.
    expect(out.body).not.toContain("מבוססת על ההוראות החלות");
  });

  it("adds no second deadline when the builder set one", () => {
    const dated: Letter = { subject: "s", body: "אבקש תשובה תוך 30 ימים.\n\nבכבוד רב,\nא" };
    const out = applyStance(dated, variantById("firm_statutory")!);
    expect(out.body.match(/ימים/g)!.length).toBe(1);
  });
});

describe("the measured dimensions map to real text", () => {
  it("names an escalation route only when the stance says to", () => {
    expect(applyStance(letter, variantById("formal_escalation")!).body).toContain("לגורם המוסמך");
    expect(applyStance(letter, variantById("cooperative_plain")!).body).not.toContain("לגורם המוסמך");
  });

  it("asks the recipient to compute the figure only when not anchoring", () => {
    const anchored = applyStance(letter, variantById("firm_statutory_anchored")!).body;
    const unanchored = applyStance(letter, variantById("firm_statutory")!).body;
    expect(unanchored).toContain("תחשבו את הסכום המדויק");
    expect(anchored).not.toContain("תחשבו את הסכום המדויק");
  });

  it("sounds cooperative or formal according to the posture", () => {
    expect(applyStance(letter, variantById("cooperative_plain")!).body).toContain("מדובר בטעות");
    expect(applyStance(letter, variantById("formal_escalation")!).body).toContain("שמורות לי מלוא טענותיי");
  });
});
