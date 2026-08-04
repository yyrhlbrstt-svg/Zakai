import { describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK } from "jose";
import { issueMandate, publicJwkFor, type SigningKey } from "./mandate";
import { institutionalVerify } from "./referenceVerifier";

describe("institutionalVerify", () => {
  it("refuses live bypass when zkm.status is present without issuer/jwksUri", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const key: SigningKey = { kid: "iv", privateJwk: await exportJWK(privateKey) };
    const token = await issueMandate(
      {
        jti: "iv-1",
        issuer: "https://issuer.example",
        audience: "bank",
        subject: "u1",
        principal: { name: "T" },
        scopes: ["request:records"],
        market: "IL",
        statement: "s",
        status: { idx: 1, uri: "https://issuer.example/api/mandate/revocations" },
      },
      key,
    );
    const live = vi.fn().mockResolvedValue("active");
    const result = await institutionalVerify({
      token,
      audience: "bank",
      publicJwks: [await publicJwkFor(key)],
      statusLookup: live,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STATUS_UNKNOWN");
    expect(live).not.toHaveBeenCalled();
  });
});
