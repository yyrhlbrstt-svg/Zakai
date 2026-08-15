import { describe, expect, it } from "vitest";
import { buildAuthorityWalletBundle } from "./walletBundle";

const sampleRow = () => ({
  code: "ZK-AAAA-BBBB",
  provider: "cellcom",
  scope: "test scope",
  status: "ACTIVE" as const,
  issuedAt: new Date("2026-01-01T00:00:00.000Z"),
  revokedAt: null,
  caseId: "case_1",
});

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

describe("the settled half of the record", () => {
  /**
   * The bundle carried the authority — proof the person allowed the claim —
   * and nothing about how it ended. Half a record is a strange thing to hand
   * someone: it proves you were entitled to ask and says nothing about what
   * you got, which is the half a counterparty or a regulator actually weighs.
   */
  it("carries the signed settlement when the case has settled", () => {
    const bundle = buildAuthorityWalletBundle({
      origin: "https://zakai.test",
      locale: "he",
      country: "IL",
      row: sampleRow(),
      settlementJws: "aaa.bbb.ccc",
    });
    expect(bundle.settlement?.jws).toBe("aaa.bbb.ccc");
    expect(bundle.settlement?.verify_post).toBe(
      "https://zakai.test/api/mandate/verify-settlement",
    );
  });

  it("says null rather than pretending there was a settlement of zero", () => {
    // An empty object here would read as "settled, recovered nothing", which
    // is a different and false claim about a case that is simply still open.
    const bundle = buildAuthorityWalletBundle({
      origin: "https://zakai.test",
      locale: "he",
      country: "IL",
      row: sampleRow(),
    });
    expect(bundle.settlement).toBeNull();
  });
});
