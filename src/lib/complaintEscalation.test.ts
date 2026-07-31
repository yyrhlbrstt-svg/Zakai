import { describe, expect, it } from "vitest";
import { ESCALATION_BODIES, buildEscalationLetter } from "./complaintEscalation";

describe("ESCALATION_BODIES", () => {
  it("has all three categories with a real name and description", () => {
    for (const category of ["bank", "telecom", "consumer"] as const) {
      const body = ESCALATION_BODIES[category];
      expect(body.nameHe.length).toBeGreaterThan(0);
      expect(body.nameEn.length).toBeGreaterThan(0);
      expect(body.descriptionHe.length).toBeGreaterThan(0);
    }
  });

  it("only sets a URL where one is actually verified — never invents one for consumer", () => {
    expect(ESCALATION_BODIES.bank.url).toMatch(/^https:\/\/www\.boi\.org\.il/);
    expect(ESCALATION_BODIES.telecom.url).toMatch(/^https:\/\/forms\.moc\.gov\.il/);
    expect(ESCALATION_BODIES.consumer.url).toBeUndefined();
  });
});

describe("buildEscalationLetter", () => {
  it("names the correct escalation body per category and includes the complaint summary", () => {
    const letter = buildEscalationLetter({
      category: "bank",
      name: "דנה כהן",
      company: "בנק הפועלים",
      originalComplaintSummary: "חויבתי פעמיים באותה עמלה ולא קיבלתי מענה תוך 45 יום",
    });
    expect(letter).toContain("היחידה לפניות הציבור ולבקרה צרכנית");
    expect(letter).toContain("בנק הפועלים");
    expect(letter).toContain("חויבתי פעמיים");
  });

  it("includes the original complaint date only when provided", () => {
    const withDate = buildEscalationLetter({
      category: "telecom",
      name: "א",
      company: "בזק",
      originalComplaintSummary: "תקלה בקו שלא תוקנה",
      originalComplaintDate: "01/03/2026",
    });
    expect(withDate).toContain("01/03/2026");

    const withoutDate = buildEscalationLetter({
      category: "telecom",
      name: "א",
      company: "בזק",
      originalComplaintSummary: "תקלה בקו שלא תוקנה",
    });
    expect(withoutDate).not.toContain("בתאריך");
  });

  it("never states a resolution timeline or success rate — only names the body and the complaint", () => {
    const letter = buildEscalationLetter({
      category: "consumer",
      name: "א",
      company: "חברה כלשהי",
      originalComplaintSummary: "לא בוטלה עסקה כנדרש בחוק",
    });
    expect(letter).not.toMatch(/\d+%/);
    expect(letter).not.toMatch(/תוך \d+ ימים ת(?:קבל|יפתר)/);
  });
});
