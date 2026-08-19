import { describe, expect, it } from "vitest";
import {
  CANCEL_TEETH_BASIS,
  cancelTeethClauseHe,
  buildContinuedBillingFollowUp,
} from "./legalTeeth";
import { buildCancelLetter } from "./cancelLetter";

describe("cancelTeethClauseHe — the written-demand position", () => {
  it("cites the cancellation section, the written-demand precondition, and the exemplary-damages section", () => {
    const clause = cancelTeethClauseHe();
    expect(clause).toContain("סעיף 13ד");
    expect(clause).toContain("סעיף 31א(ב)");
    expect(clause).toContain("סעיף 31א");
    expect(clause).toContain("דרישה בכתב");
  });

  it("states the statutory maximum and the no-proof-of-damage rule", () => {
    const clause = cancelTeethClauseHe();
    expect(clause).toContain("10,000");
    expect(clause).toContain("ללא הוכחת נזק");
  });

  it("describes what the court MAY do — never promises an outcome", () => {
    const clause = cancelTeethClauseHe();
    // "מסמיך את בית המשפט לפסוק" — empowerment, not a promise.
    expect(clause).toContain("מסמיך את בית המשפט");
    expect(clause).not.toMatch(/תחויבו|מובטח|בוודאות/);
  });

  it("keeps the basis record and the clause in sync", () => {
    const clause = cancelTeethClauseHe();
    expect(clause).toContain(CANCEL_TEETH_BASIS.law);
    expect(clause).toContain(
      CANCEL_TEETH_BASIS.maxExemplaryShekels.toLocaleString("he-IL"),
    );
  });
});

describe("buildCancelLetter — teeth only where the statute applies", () => {
  const base = { customerName: "דנה", company: "חברה", product: "מנוי" };

  it("embeds the statutory clause in a cancellation", () => {
    const { body, subject } = buildCancelLetter({ ...base, intent: "cancel" });
    expect(body).toContain("סעיף 13ד");
    expect(body).toContain("דרישה בכתב");
    expect(body).toContain("ללא הוכחת נזק");
    // The subject says notice-in-writing, not "request" — the legal position
    // starts in the subject line a clerk reads first.
    expect(subject).toContain("הודעת ביטול");
  });

  it.each(["retention", "downgrade", "pause"] as const)(
    "never attaches exemplary-damages language to a commercial %s ask",
    (intent) => {
      const { body } = buildCancelLetter({ ...base, intent });
      expect(body).not.toContain("31א");
      expect(body).not.toContain("פיצויים לדוגמה");
    },
  );
});

describe("buildContinuedBillingFollowUp — the next rung, not a repeat ask", () => {
  const input = {
    customerName: "דנה",
    company: "חברה",
    product: "מנוי עיתון",
    cancelNoticeDateLabel: "2026-08-01",
  };

  it("anchors on the original written notice and its date", () => {
    const { body } = buildContinuedBillingFollowUp(input);
    expect(body).toContain("2026-08-01");
    expect(body).toContain("הודעת ביטול בכתב");
    expect(body).toContain("סעיף 31א(ב)");
  });

  it("demands restitution plus cites the exemplary exposure, with a concrete deadline", () => {
    const { body } = buildContinuedBillingFollowUp(input);
    expect(body).toContain("השבה מלאה");
    expect(body).toContain("10,000");
    expect(body).toContain("7 ימי עסקים");
  });

  it("names the ladder's next rungs — regulator and small claims — as prepared, not threatened vaguely", () => {
    const { body } = buildContinuedBillingFollowUp(input);
    expect(body).toContain("פניות הציבור");
    expect(body).toContain("תביעות קטנות");
  });

  it("mentions an amount only when the user actually observed one", () => {
    const without = buildContinuedBillingFollowUp(input).body;
    expect(without).not.toMatch(/בסך כ-₪/);
    const withAmt = buildContinuedBillingFollowUp({
      ...input,
      chargedAfterShekels: 79.9,
    }).body;
    expect(withAmt).toContain("בסך כ-₪80");
  });

  it("speaks as the Mandate agent, in writing only", () => {
    const { body } = buildContinuedBillingFollowUp(input);
    expect(body).toContain("Mandate");
    expect(body).toContain("נא מענה בכתב בלבד");
  });
});
