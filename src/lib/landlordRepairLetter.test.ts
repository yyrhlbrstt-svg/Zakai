import { describe, expect, it } from "vitest";
import { buildLandlordRepairLetter } from "./landlordRepairLetter";

describe("buildLandlordRepairLetter", () => {
  it("cites the Rental and Lending Law and the defect description", () => {
    const letter = buildLandlordRepairLetter({
      tenantName: "נועה",
      landlordName: "יעקב",
      propertyAddress: "הרצל 10, תל אביב",
      defectDescription: "נזילה בתקרת חדר השינה",
      daysSinceReported: 14,
    });
    expect(letter.subject).toContain("הרצל 10, תל אביב");
    expect(letter.body).toContain("חוק השכירות והשאילה");
    expect(letter.body).toContain("נזילה בתקרת חדר השינה");
    expect(letter.body).toContain("14 ימים");
  });

  it("never invents a repair cost when none was given", () => {
    const letter = buildLandlordRepairLetter({
      tenantName: "דן",
      landlordName: "רחל",
      propertyAddress: "אלנבי 5",
      defectDescription: "דלת כניסה שבורה",
    });
    expect(letter.body).not.toContain("₪");
  });

  it("includes the reimbursement clause only when a repair cost estimate exists", () => {
    const letter = buildLandlordRepairLetter({
      tenantName: "דן",
      landlordName: "רחל",
      propertyAddress: "אלנבי 5",
      defectDescription: "דלת כניסה שבורה",
      estimatedRepairCostShekels: 600,
    });
    expect(letter.body).toContain("₪600");
  });

  it("falls back to generic placeholders rather than empty strings", () => {
    const letter = buildLandlordRepairLetter({
      tenantName: "",
      landlordName: "",
      propertyAddress: "",
      defectDescription: "משהו שבור",
    });
    expect(letter.body).toContain("השוכר/ת");
    expect(letter.body).toContain("המשכיר/ה");
  });
});
