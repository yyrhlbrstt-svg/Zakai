import { describe, expect, it } from "vitest";
import { resolveAirlineContactEmail, resolveAirlineProviderKey } from "./airlineContacts";

describe("airlineContacts", () => {
  it("resolves known carriers", () => {
    expect(resolveAirlineContactEmail("EL AL")).toContain("@elal");
    expect(resolveAirlineProviderKey("אל על")).toBe("elal");
  });

  it("falls back without inventing a real inbox", () => {
    expect(resolveAirlineContactEmail("Unknown Wings LLC")).toBe("customerservice@airline.example");
  });
});
