import { beforeAll, describe, expect, it } from "vitest";
import { CompactSign, exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose";
import {
  DEFAULT_TTL_SECONDS,
  MandateError,
  LEGACY_MANDATE_TYPE,
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

  it("embeds zkm.status.idx for offline status-list revocation", async () => {
    const token = await issueMandate(
      {
        ...base,
        status: { idx: 42, uri: "https://zakai.app/api/mandate/revocations" },
      },
      key,
    );
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
    });
    expect(claims.status).toEqual({
      idx: 42,
      uri: "https://zakai.app/api/mandate/revocations",
    });

    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    ) as { zkm: { status: { idx: number; uri: string } } };
    expect(payload.zkm.status.idx).toBe(42);
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

  it("carries delegation as a structured claim, not only a sentence", async () => {
    // A verifier's code must be able to branch on this without parsing the
    // free-text statement — that was the entire point of adding the field.
    const onBehalfOf = { agent: "agent.example", name: "Agent Example", note: "verified by them" };
    const token = await issueMandate({ ...base, onBehalfOf }, key);
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
    });
    expect(claims.onBehalfOf).toEqual(onBehalfOf);
  });

  it("leaves onBehalfOf absent for a first-party mandate", async () => {
    const token = await issueMandate(base, key);
    const claims = await verifyMandate(token, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
    });
    expect(claims.onBehalfOf).toBeUndefined();
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
    // Escalate the grant: append a scope the holder was never given. Under the
    // JWT envelope this lives in the OAuth-style `scope` string.
    decoded.scope = `${decoded.scope} contract:cancel`;
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

describe("anyone can verify it with the library they already have", () => {
  /**
   * The adoption test, and the reason the envelope changed.
   *
   * This uses `jwtVerify` — the ordinary JWT entry point every language has an
   * equivalent of — with no Zakai import beyond the token itself. If this test
   * ever needs a helper from our own code to pass, the mandate has stopped
   * being a protocol and gone back to being a product feature.
   */
  it("verifies with a plain jwtVerify and no Zakai code at all", async () => {
    const token = await issueMandate(base, key);
    const publicKey = await importJWK(await publicJwkFor(key), "EdDSA");

    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      issuer: "https://zakai.app",
      audience: "bank:il:leumi",
    });

    expect(protectedHeader.typ).toBe("JWT");
    expect(protectedHeader.alg).toBe("EdDSA");
    expect(payload.sub).toBe("usr_123");
    expect(payload.jti).toBe("mnd_01");
    // The grant reads as OAuth scope, so a gateway that speaks OAuth needs no
    // schooling in what Zakai is.
    expect(payload.scope).toBe("read:transactions dispute:charge");
  });

  it("lets a standard validator enforce audience and expiry for us", async () => {
    const token = await issueMandate(base, key);
    const publicKey = await importJWK(await publicJwkFor(key), "EdDSA");

    // Wrong audience — rejected by the library, not by our code.
    await expect(
      jwtVerify(token, publicKey, { audience: "bank:il:hapoalim" }),
    ).rejects.toThrow();

    // Expired — likewise.
    const stale = await issueMandate(
      { ...base, now: new Date("2020-01-01T00:00:00Z"), ttlSeconds: 60 },
      key,
    );
    await expect(jwtVerify(stale, publicKey, { audience: "bank:il:leumi" })).rejects.toThrow();
  });

  it("carries the non-standard parts under one namespaced claim", async () => {
    const token = await issueMandate(base, key);
    const publicKey = await importJWK(await publicJwkFor(key), "EdDSA");
    const { payload } = await jwtVerify(token, publicKey, { audience: "bank:il:leumi" });

    const zkm = payload.zkm as Record<string, unknown>;
    expect(zkm.market).toBe("IL");
    expect((zkm.principal as { name: string }).name).toBe("דנה כהן");
    expect(typeof zkm.statement).toBe("string");
  });

  it("still verifies a mandate issued under the pre-JWT envelope", async () => {
    // A protocol that invalidates outstanding credentials on an internal
    // refactor is not one anybody will build against.
    const nowSec = Math.floor(Date.now() / 1000);
    const legacyPayload = {
      v: 1,
      jti: "legacy_01",
      iss: "https://zakai.app",
      aud: "bank:il:leumi",
      sub: "usr_legacy",
      principal: { name: "Old Holder" },
      scopes: ["read:transactions"],
      market: "IL",
      iat: nowSec,
      nbf: nowSec,
      exp: nowSec + 3600,
      statement: "legacy",
    };
    const privateKey = await importJWK(key.privateJwk, "EdDSA");
    const legacyToken = await new CompactSign(
      new TextEncoder().encode(JSON.stringify(legacyPayload)),
    )
      .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: LEGACY_MANDATE_TYPE })
      .sign(privateKey);

    const claims = await verifyMandate(legacyToken, {
      audience: "bank:il:leumi",
      publicJwks: await publicKeys(key),
    });
    expect(claims.sub).toBe("usr_legacy");
    expect(claims.scopes).toEqual(["read:transactions"]);
  });
});

describe("a misconfigured key says which mistake was made", () => {
  it("reports a missing variable as missing", () => {
    const err = (() => { try { loadSigningKeyFromEnv({}); } catch (e) { return e as MandateKeyUnavailableError; } })()!;
    expect(err.reason).toBe("missing");
    expect(err.message).toMatch(/not set/);
  });

  it("reports quote-stripped JSON as malformed, and names the cause", () => {
    // The single most common way this breaks: a shell sourced the value and
    // ate the quotes. It looks exactly like not-configured, and sends an
    // operator hunting for a variable that is already there.
    const err = (() => {
      try {
        loadSigningKeyFromEnv({
          MANDATE_SIGNING_KID: "k",
          MANDATE_SIGNING_JWK: "{crv:Ed25519,d:abc,kty:OKP}",
        });
      } catch (e) { return e as MandateKeyUnavailableError; }
    })()!;
    expect(err.reason).toBe("malformed");
    expect(err.message).toMatch(/quotes around the JSON were stripped/);
  });

  it("refuses the public half, and says that is what it is", () => {
    // Otherwise this passes load and fails at signing time, surfacing as a
    // mysterious 500 on the first mandate anyone tries to issue.
    const err = (() => {
      try {
        loadSigningKeyFromEnv({
          MANDATE_SIGNING_KID: "k",
          MANDATE_SIGNING_JWK: JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "pub" }),
        });
      } catch (e) { return e as MandateKeyUnavailableError; }
    })()!;
    expect(err.reason).toBe("malformed");
    expect(err.message).toMatch(/public key/);
  });

  it("refuses the wrong key type by name", () => {
    const err = (() => {
      try {
        loadSigningKeyFromEnv({
          MANDATE_SIGNING_KID: "k",
          MANDATE_SIGNING_JWK: JSON.stringify({ kty: "RSA", d: "x" }),
        });
      } catch (e) { return e as MandateKeyUnavailableError; }
    })()!;
    expect(err.message).toMatch(/kty="RSA"/);
  });

  it("tolerates surrounding whitespace, which every paste introduces", () => {
    const jwk = JSON.stringify({ kty: "OKP", crv: "Ed25519", d: "priv", x: "pub" });
    const loaded = loadSigningKeyFromEnv({
      MANDATE_SIGNING_KID: "  kid-with-spaces  ",
      MANDATE_SIGNING_JWK: `  ${jwk}  `,
    });
    expect(loaded.kid).toBe("kid-with-spaces");
  });
});
