import { describe, expect, it } from "vitest";
import { resolveBankProvider } from "./normalizeBankProvider";

describe("resolveBankProvider", () => {
  it("uses structured bank key", () => {
    expect(resolveBankProvider({ bankKey: "leumi" })).toEqual({
      providerKey: "leumi",
      displayName: "בנק לאומי",
    });
  });

  it("fuzzy-matches Hebrew bank names", () => {
    expect(resolveBankProvider({ bankName: "הפועלים" }).providerKey).toBe("hapoalim");
    expect(resolveBankProvider({ bankName: "  בנק לאומי " }).providerKey).toBe("leumi");
  });

  it("keeps custom name for unknown banks", () => {
    const r = resolveBankProvider({ bankKey: "other", bankName: "בנק קטן" });
    expect(r.providerKey).toBe("בנק קטן");
    expect(r.displayName).toBe("בנק קטן");
  });
});
