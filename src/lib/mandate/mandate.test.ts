import { beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import {
  DEFAULT_TTL_SECONDS,
  MandateError,
  MandateKeyUnavailableError,
  issueMandate,
  loadSigningKeyFromEnv,
  mandateAllows,
  publicJwkFor,
  verifyMandate,
  type SigningKey,
} from "./mandate";
import {
  FORBIDDEN_SCOPES,
  SCOPES,
  highestTier,
  requiresPerActConfirmation,
  validateScopes,
} from "./scopes";

let key: SigningKey;
let otherKey: SigningKey;

beforeAll(async () => {
  const a = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const b = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  key = { kid: "zakai-2026-07", privateJwk: await exportJWK(a.privateKey) };
  otherKey = { kid: "someone-else", privateJwk: await exportJWK(b.privateKey) };
});

const base = {
  jti: "mnd_01",
  issuer: "https://zakai.app",
  audience: "bank:il:leumi",
  subject: "usr_123",
  principal: { name: "דנה כהן", reference: "0123456789", contactMasked: "05*-***-**89" },
  scopes: ["read:transactions", "dispute:charge"],
  market: "IL",
  statement: "Zakai is authorised to review charges and dispute overcharges on the holder's behalf.",
};

async function publicKeys(...keys: SigningKey[]) {
  return Promise.all(keys.map(publicJwkFor));
}

describe("issuing and verifying", () => {
  it("round-trips a mandate an institution can verify offline", async () => {
    const token = await issueMandate(base, key);
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
    });

    expect(claims.sub).toBe("usr_123");
    expect(claims.market).toBe("IL");
    expect(claims.scopes).toEqual(["read:transactions", "dispute:charge"]);
    expect(mandateAllows(claims, "dispute:charge")).toBe(true);
    expect(mandateAllows(claims, "contract:cancel")).toBe(false);
  });

  it("publishes a public key with no private component", async () => {
    const jwk = await publicJwkFor(key);
    expect(jwk.d).toBeUndefined();
    expect(jwk.kid).toBe("zakai-2026-07");
    expect(jwk.alg).toBe("EdDSA");
  });

  it("verifies against a JWKS containing several keys, for rotation", async () => {
    const token = await issueMandate(base, key);
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(otherKey, key),
    });
    expect(claims.jti).toBe("mnd_01");
  });

  it("defaults to a short lifetime", async () => {
    const now = new Date("2026-07-26T00:00:00Z");
    const token = await issueMandate({ ...base, now }, key);
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
      now,
    });
    expect(claims.exp - claims.iat).toBe(DEFAULT_TTL_SECONDS);
  });
});

describe("the attacks this design exists to stop", () => {
  it("rejects a mandate replayed at a different institution", async () => {
    const token = await issueMandate(base, key);
    await expect(
      verifyMandate(token, { audience: "bank:il:hapoalim", publicJwks: await publicKeys(key) }),
    ).rejects.toMatchObject({ code: "AUDIENCE_MISMATCH" });
  });

  it("rejects a mandate signed by a key the institution does not trust", async () => {
    const token = await issueMandate(base, otherKey);
    await expect(
      verifyMandate(token, { audience: "bank:il:leumi", publicJwks: await publicKeys(key) }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("rejects a tampered payload", async () => {
    const token = await issueMandate(base, key);
    const [header, payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    decoded.scopes.push("contract:cancel");
    const forged = [
      header,
      Buffer.from(JSON.stringify(decoded)).toString("base64url"),
      signature,
    ].join(".");

    await expect(
      verifyMandate(forged, { audience: "bank:il:leumi", publicJwks: await publicKeys(key) }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("rejects an expired mandate", async () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const token = await issueMandate({ ...base, now: issued, ttlSeconds: 3600 }, key);
    await expect(
      verifyMandate(token, {
        audience: "bank:il:leumi",
        publicJwks: await publicKeys(key),
        now: new Date("2026-01-01T02:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "EXPIRED" });
  });

  it("tolerates small clock skew rather than failing a valid mandate", async () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const token = await issueMandate({ ...base, now: issued, ttlSeconds: 3600 }, key);
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
      now: new Date("2025-12-31T23:59:30Z"),
    });
    expect(claims.jti).toBe("mnd_01");
  });
});

describe("a mandate can never move money outward", () => {
  it("refuses to issue a mandate carrying a forbidden scope", async () => {
    for (const forbidden of FORBIDDEN_SCOPES) {
      await expect(issueMandate({ ...base, scopes: [forbidden] }, key)).rejects.toBeInstanceOf(
        MandateError,
      );
    }
  });

  it("names the reason, so the refusal is legible to an integrator", async () => {
    await expect(
      issueMandate({ ...base, scopes: ["payment:initiate"] }, key),
    ).rejects.toThrow(/must not move money outward/);
  });

  it("declares no scope that moves money outward", () => {
    for (const def of SCOPES) {
      expect(FORBIDDEN_SCOPES).not.toContain(def.scope);
    }
    // The only funds-touching tier is inbound.
    const fundScopes = SCOPES.filter((s) => s.tier === "inbound_funds").map((s) => s.scope);
    expect(fundScopes).toEqual(["settle:receive"]);
  });
});

describe("scope validation", () => {
  it("rejects unknown scopes instead of silently dropping them", () => {
    expect(validateScopes(["read:transactions", "read:mind"])).toContain(
      'unknown scope "read:mind"',
    );
  });

  it("rejects an empty grant and duplicates", () => {
    expect(validateScopes([])).toHaveLength(1);
    expect(validateScopes(["read:accounts", "read:accounts"])).toContain(
      'duplicate scope "read:accounts"',
    );
  });

  it("requires per-act confirmation for everything that changes the world", () => {
    for (const def of SCOPES) {
      if (def.tier !== "read" && def.scope !== "request:records") {
        expect(requiresPerActConfirmation(def.scope)).toBe(true);
      }
    }
    expect(requiresPerActConfirmation("read:transactions")).toBe(false);
  });

  it("treats an unrecognised scope as needing confirmation", () => {
    expect(requiresPerActConfirmation("something:new")).toBe(true);
  });

  it("reports the highest tier so consent can be escalated", () => {
    expect(highestTier(["read:accounts"])).toBe("read");
    expect(highestTier(["read:accounts", "claim:submit"])).toBe("correspond");
    expect(highestTier(["read:accounts", "settle:receive"])).toBe("inbound_funds");
  });

  it("gives every scope a plain-language summary for the consent screen", () => {
    for (const def of SCOPES) {
      expect(def.summary.length).toBeGreaterThan(20);
      expect(def.summary.endsWith(".")).toBe(true);
    }
  });
});

describe("key loading", () => {
  it("throws rather than self-signing with an ephemeral key", () => {
    expect(() => loadSigningKeyFromEnv({})).toThrow(MandateKeyUnavailableError);
    expect(() =>
      loadSigningKeyFromEnv({ MANDATE_SIGNING_JWK: "not json", MANDATE_SIGNING_KID: "k" }),
    ).toThrow(MandateKeyUnavailableError);
  });

  it("loads a well-formed key", () => {
    const loaded = loadSigningKeyFromEnv({
      MANDATE_SIGNING_JWK: JSON.stringify(key.privateJwk),
      MANDATE_SIGNING_KID: "zakai-2026-07",
    });
    expect(loaded.kid).toBe("zakai-2026-07");
  });
});
