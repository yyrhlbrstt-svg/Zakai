import { describe, expect, it } from "vitest";
import { buildAuthorityWalletBundle } from "./walletBundle";

describe("walletBundle", () => {
  it("includes verify and mandate endpoints", () => {
    const bundle = buildAuthorityWalletBundle({
      origin: "https://zakai.example",
      locale: "he",
      country: "IL",
      row: {
        code: "ZK-AAAA-BBBB",
        provider: "cellcom",
        scope: "test scope",
        status: "ACTIVE",
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        revokedAt: null,
        caseId: "case_1",
      },
    });
    expect(bundle.spec).toBe("zakai-authority-wallet");
    expect(bundle.verify.public_page).toContain("ZK-AAAA-BBBB");
    expect(bundle.mandate_infrastructure.jwks).toContain("zakai-jwks");
  });
});
