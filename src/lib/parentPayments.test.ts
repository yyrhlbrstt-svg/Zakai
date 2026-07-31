import { describe, it, expect } from "vitest";
import {
  MANDATORY_PAYMENT_CATEGORY_HE,
  MANDATORY_PAYMENT_CIRCULAR_URL,
  isMandatoryPayment,
  buildParentPaymentLetter,
} from "./parentPayments";

describe("isMandatoryPayment", () => {
  it("is mandatory only for accident insurance", () => {
    expect(isMandatoryPayment("accident_insurance")).toBe(true);
  });

  it("is voluntary for anything else", () => {
    expect(isMandatoryPayment("other")).toBe(false);
  });
});

describe("buildParentPaymentLetter", () => {
  const base = {
    parentName: "מיכל לוי",
    studentName: "עדן לוי",
    institutionName: 'גן "שקד"',
    chargeDescription: "תמונות כיתתיות",
    chargeAmountShekels: 120,
    reason: "לא ניתנה הסכמה מפורשת לתשלום, והוא הוצג כתנאי להשתתפות באירוע הכיתתי.",
  };

  it("includes the parent, student, institution, charge and reason", () => {
    const letter = buildParentPaymentLetter(base);
    expect(letter).toContain(base.parentName);
    expect(letter).toContain(base.studentName);
    expect(letter).toContain(base.institutionName);
    expect(letter).toContain(base.chargeDescription);
    expect(letter).toContain(String(base.chargeAmountShekels));
    expect(letter).toContain(base.reason);
  });

  it("cites the real mandatory-vs-voluntary rule, never a specific outcome", () => {
    const letter = buildParentPaymentLetter(base);
    expect(letter).toContain("ביטוח תאונות אישיות");
    expect(letter).toContain("תשלום רשות");
    expect(letter).not.toMatch(/מובטח|בוודאות תוחזר/);
  });

  it("carries the standard letter footer", () => {
    expect(buildParentPaymentLetter(base)).toContain("זכאי");
  });
});

describe("verified constants", () => {
  it("names the one real mandatory category", () => {
    expect(MANDATORY_PAYMENT_CATEGORY_HE).toBe("ביטוח תאונות אישיות");
  });

  it("points at the real Ministry of Education circular", () => {
    expect(MANDATORY_PAYMENT_CIRCULAR_URL).toMatch(/^https:\/\/apps\.education\.gov\.il\//);
  });
});
