import { describe, expect, it } from "vitest";
import { ESCALATION_BODIES, buildEscalationLetter, complaintCategoryForVertical } from "./complaintEscalation";

describe("ESCALATION_BODIES", () => {
  it("has all three categories with a real name and description", () => {
    for (const category of ["bank", "telecom", "consumer"] as const) {
      const body = ESCALATION_BODIES[category];
      expect(body.nameHe.length).toBeGreaterThan(0);
      expect(body.nameEn.length).toBeGreaterThan(0);
      expect(body.descriptionHe.length).toBeGreaterThan(0);
    }
  });

  it("every URL is a verified official domain — sourced from the recipient directory", () => {
    // Identity + intake URL now come from rightsGraph/directory.ts, which
    // carries lastVerifiedAt per entry. The consumer authority gained a real
    // gov.il complaint form (verified 2026-08-20) — no longer url-less.
    expect(ESCALATION_BODIES.bank.url).toMatch(/^https:\/\/www\.boi\.org\.il/);
    expect(ESCALATION_BODIES.telecom.url).toMatch(/^https:\/\/www\.gov\.il/);
    expect(ESCALATION_BODIES.consumer.url).toMatch(
      /^https:\/\/www\.gov\.il\/he\/service\/filing_a_complaint_to_fair_trade_authority$/,
    );
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

describe("complaintCategoryForVertical", () => {
  it("routes telecom cases to the Ministry of Communications", () => {
    expect(complaintCategoryForVertical("telecom")).toBe("telecom");
  });

  it("routes bank/deposit/late-payment/refund-chase cases to Banking Supervision", () => {
    expect(complaintCategoryForVertical("bank-fees")).toBe("bank");
    expect(complaintCategoryForVertical("deposit")).toBe("bank");
    expect(complaintCategoryForVertical("late-payment")).toBe("bank");
    expect(complaintCategoryForVertical("refund-chase")).toBe("bank");
  });

  it("falls back to the general consumer authority for everything else, including missing data", () => {
    expect(complaintCategoryForVertical("subscription")).toBe("consumer");
    expect(complaintCategoryForVertical("parking")).toBe("consumer");
    expect(complaintCategoryForVertical(undefined)).toBe("consumer");
    expect(complaintCategoryForVertical(null)).toBe("consumer");
  });
});
