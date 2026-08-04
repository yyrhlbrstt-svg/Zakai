import { describe, expect, it } from "vitest";
import { resolveElectricityContactEmail, resolveInsuranceContactEmail } from "./utilityContacts";

describe("utilityContacts", () => {
  it("resolves IEC and Partner Power", () => {
    expect(resolveElectricityContactEmail("IEC")).toMatch(/@/);
    expect(resolveElectricityContactEmail("פרטנר פאוור")).toMatch(/@/);
  });

  it("resolves major insurers", () => {
    expect(resolveInsuranceContactEmail("הפניקס")).toMatch(/@/);
    expect(resolveInsuranceContactEmail("harel")).toMatch(/@/);
  });

  it("returns null for unknown", () => {
    expect(resolveElectricityContactEmail("Totally Fake Power Co XYZ")).toBeNull();
  });
});
