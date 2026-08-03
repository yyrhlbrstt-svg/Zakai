import { describe, expect, it } from "vitest";
import { resolveBankContactEmail } from "./bankContacts";

describe("bankContacts", () => {
  it("returns empty when no override is configured", () => {
    expect(resolveBankContactEmail("leumi")).toBe("");
    expect(resolveBankContactEmail("unknown-bank")).toBe("");
  });
});
