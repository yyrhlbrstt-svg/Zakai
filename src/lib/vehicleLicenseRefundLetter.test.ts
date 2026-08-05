import { describe, expect, it } from "vitest";
import { buildVehicleLicenseRefundLetter } from "./vehicleLicenseRefundLetter";

describe("buildVehicleLicenseRefundLetter", () => {
  it("cites the Traffic Regulations and explicitly excludes a regular sale", () => {
    const letter = buildVehicleLicenseRefundLetter({
      customerName: "אלון",
      licensePlate: "12-345-67",
      reason: "total_loss",
      cancellationDate: "01/08/2026",
      annualFeeShekels: 900,
    });
    expect(letter.body).toContain("תקנות התעבורה");
    expect(letter.body).toContain("איני מבקש/ת החזר על בסיס מכירה");
    expect(letter.body).toContain("טוטאל לוס");
    expect(letter.body).toContain("₪900.00");
  });

  it("uses the cancelled-license reason text for that reason", () => {
    const letter = buildVehicleLicenseRefundLetter({
      customerName: "נעם",
      licensePlate: "",
      reason: "cancelled",
      cancellationDate: "02/08/2026",
    });
    expect(letter.body).toContain("בוטל רישוי הרכב");
    expect(letter.body).not.toContain("₪");
  });

  it("falls back to a placeholder name rather than an empty string", () => {
    const letter = buildVehicleLicenseRefundLetter({
      customerName: "",
      licensePlate: "",
      reason: "cancelled",
      cancellationDate: "",
    });
    expect(letter.body).toContain("הלקוח/ה");
  });
});
