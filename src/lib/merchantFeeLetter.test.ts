import { describe, expect, it } from "vitest";
import { buildMerchantFeeLetter } from "./merchantFeeLetter";

const base = { businessName: "מאפיית רחוב הגפן", acquirer: "ישראכרט", concern: "rate_too_high" as const };

describe("buildMerchantFeeLetter", () => {
  it("names the business and the acquirer", () => {
    const { subject, body } = buildMerchantFeeLetter(base);
    expect(subject).toContain("מאפיית רחוב הגפן");
    expect(body).toContain("ישראכרט");
  });

  it("always asks for the fees in writing — that request is the whole point", () => {
    const { body } = buildMerchantFeeLetter(base);
    expect(body).toContain("פירוט מלא בכתב");
  });

  it("omits optional identifiers rather than inventing them", () => {
    const { body } = buildMerchantFeeLetter(base);
    expect(body).not.toContain("ח.פ.");
    expect(body).not.toContain("מספר בית עסק");
    expect(body).not.toContain("מחזור סליקה");
  });

  it("includes identifiers when supplied", () => {
    const { body } = buildMerchantFeeLetter({
      ...base,
      businessId: "512345678",
      merchantNumber: "0099887",
      monthlyTurnoverShekels: 48000,
    });
    expect(body).toContain("512345678");
    expect(body).toContain("0099887");
    expect(body).toContain("48,000");
  });

  /**
   * The guard that matters. Real clearing rates depend on card mix, ticket
   * size, MCC and volume; no public table is accurate enough to quote at a
   * specific shop. Naming a "should pay" number would be inventing a saving.
   */
  it("never quotes a benchmark rate the product cannot stand behind", () => {
    for (const concern of ["rate_too_high", "terminal_rental", "monthly_minimum", "unexplained_charge", "other"] as const) {
      const { body } = buildMerchantFeeLetter({ ...base, concern });
      expect(body).not.toMatch(/\d+(\.\d+)?\s*%/);
      expect(body).not.toMatch(/ממוצע בשוק|התעריף המקובל|אמור לשלם/);
    }
  });

  it("falls back to neutral wording when free-text fields are blank", () => {
    const { body } = buildMerchantFeeLetter({ businessName: "  ", acquirer: "  ", concern: "other" });
    expect(body).toContain("העסק");
    expect(body).toContain("חברת הסליקה");
  });

  it("reflects the chosen concern", () => {
    expect(buildMerchantFeeLetter({ ...base, concern: "terminal_rental" }).body).toContain("מסוף");
    expect(buildMerchantFeeLetter({ ...base, concern: "monthly_minimum" }).body).toContain("מינימום");
  });
});
