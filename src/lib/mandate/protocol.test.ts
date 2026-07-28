import { beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose";
import { issueMandate, publicJwkFor, type SigningKey } from "./mandate";
import {
  BITS_PER_STATUS,
  STATUS_LIST_TYPE,
  StatusListError,
  packStatusList,
  readStatus,
  signStatusList,
  verifyStatusList,
} from "./statusList";
import {
  ISSUERS,
  decideTrust,
  registryDocument,
  validateIssuer,
  type RegisteredIssuer,
} from "./trustRegistry";
import { FORBIDDEN_SCOPES } from "./scopes";

let key: SigningKey;
let otherKey: SigningKey;

beforeAll(async () => {
  const a = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const b = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  key = { kid: "zakai-2026-07", privateJwk: await exportJWK(a.privateKey) };
  otherKey = { kid: "other-issuer", privateJwk: await exportJWK(b.privateKey) };
});

const ISS = "https://zakai.app";

describe("revocation works while we are down", () => {
  it("answers offline from one signed artefact, with no call to the issuer", async () => {
    const token = await signStatusList(
      { issuer: ISS, revokedIndices: [3, 900_000], size: 1_000_000, ttlSeconds: 900 },
      key,
    );
    const list = await verifyStatusList(token, { issuer: ISS, publicJwks: [await publicJwkFor(key)] });

    expect(list.isRevoked(3)).toBe(true);
    expect(list.isRevoked(900_000)).toBe(true);
    expect(list.isRevoked(4)).toBe(false);
    expect(list.isRevoked(999_999)).toBe(false);
  });

  it("stays small enough to fetch constantly", async () => {
    // A million mandates with sparse revocations, which is the real shape.
    const revoked = Array.from({ length: 500 }, (_, i) => i * 1_500);
    const packed = packStatusList(revoked, 1_000_000);
    expect(packed.length).toBeLessThan(20_000);
    expect(readStatus(packed, 1_500)).toBe(true);
    expect(readStatus(packed, 1_501)).toBe(false);
  });

  it("refuses a stale list rather than serving old revocation data", async () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const token = await signStatusList(
      { issuer: ISS, revokedIndices: [1], size: 100, ttlSeconds: 300, now: issued },
      key,
    );
    await expect(
      verifyStatusList(token, {
        issuer: ISS,
        publicJwks: [await publicJwkFor(key)],
        now: new Date("2026-01-01T01:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(StatusListError);
  });

  it("refuses a list signed by a key it does not trust", async () => {
    const token = await signStatusList(
      { issuer: ISS, revokedIndices: [], size: 10, ttlSeconds: 900 },
      otherKey,
    );
    await expect(
      verifyStatusList(token, { issuer: ISS, publicJwks: [await publicJwkFor(key)] }),
    ).rejects.toThrow(/no configured key/);
  });

  it("refuses one issuer's list as evidence about another's mandates", async () => {
    const token = await signStatusList(
      { issuer: "https://someone-else.example", revokedIndices: [], size: 10, ttlSeconds: 900 },
      key,
    );
    await expect(
      verifyStatusList(token, { issuer: ISS, publicJwks: [await publicJwkFor(key)] }),
    ).rejects.toThrow(/expected/);
  });

  it("treats an index beyond the list as valid, never as revoked", () => {
    const packed = packStatusList([2], 8);
    expect(readStatus(packed, 2)).toBe(true);
    expect(readStatus(packed, 5_000)).toBe(false);
    expect(readStatus(packed, -1)).toBe(false);
  });

  it("drops an out-of-range revocation instead of refusing to build the list", () => {
    // One malformed row must not mean nobody can check revocation at all.
    expect(() => packStatusList([1, 99_999], 16)).not.toThrow();
    expect(readStatus(packStatusList([1, 99_999], 16), 1)).toBe(true);
  });

  it("rejects a negative index outright, which can only be a bug", () => {
    expect(() => packStatusList([-3], 16)).toThrow(StatusListError);
  });

  it("is a signed JWT anyone can open with a standard library", async () => {
    const token = await signStatusList(
      { issuer: ISS, revokedIndices: [7], size: 64, ttlSeconds: 900 },
      key,
    );
    const { payload, protectedHeader } = await jwtVerify(
      token,
      await importJWK(await publicJwkFor(key), "EdDSA"),
      { issuer: ISS },
    );
    expect(protectedHeader.typ).toBe(STATUS_LIST_TYPE);
    const sl = payload.status_list as { bits: number; lst: string };
    expect(sl.bits).toBe(BITS_PER_STATUS);
    expect(readStatus(sl.lst, 7)).toBe(true);
  });
});

describe("the registry makes it a protocol, not our API", () => {
  const candidate: RegisteredIssuer = {
    iss: "https://agent.example",
    name: "Example Agent Co",
    jwksUri: "https://agent.example/.well-known/jwks.json",
    statusListUri: "https://agent.example/status",
    allowedScopes: ["read:transactions", "contract:cancel"],
    status: "active",
    admittedAt: "2026-07-28",
  };

  it("admits a well-formed issuer", () => {
    expect(validateIssuer(candidate)).toEqual([]);
  });

  it("refuses to admit any issuer on plain HTTP", () => {
    const problems = validateIssuer({ ...candidate, jwksUri: "http://agent.example/jwks" });
    expect(problems).toContainEqual({
      kind: "insecure_uri",
      field: "jwksUri",
      value: "http://agent.example/jwks",
    });
  });

  it("never lets an issuer negotiate a forbidden scope, however important it is", () => {
    for (const scope of FORBIDDEN_SCOPES) {
      const problems = validateIssuer({ ...candidate, allowedScopes: [scope] });
      expect(problems).toContainEqual({ kind: "forbidden_scope", scope });
    }
  });

  it("rejects scopes the protocol has never heard of", () => {
    expect(validateIssuer({ ...candidate, allowedScopes: ["read:everything"] })).toContainEqual({
      kind: "unknown_scope",
      scope: "read:everything",
    });
  });

  it("rejects a duplicate issuer identity", () => {
    expect(validateIssuer({ ...candidate, iss: ISSUERS[0].iss })).toContainEqual({
      kind: "duplicate_iss",
      iss: ISSUERS[0].iss,
    });
  });

  it("holds the registry operator to the same rules as everyone else", () => {
    for (const issuer of ISSUERS) {
      // Validated against an empty existing set so its own presence is not a
      // duplicate — everything else must still pass.
      expect({ iss: issuer.iss, problems: validateIssuer(issuer, []) }).toEqual({
        iss: issuer.iss,
        problems: [],
      });
    }
  });
});

describe("deciding whether to honour a mandate", () => {
  it("trusts a listed, active issuer within its grant", () => {
    const d = decideTrust(ISSUERS[0].iss, ["read:transactions", "dispute:charge"]);
    expect(d.trusted).toBe(true);
  });

  it("refuses an issuer nobody has admitted", () => {
    expect(decideTrust("https://not-in-registry.example", ["read:transactions"])).toEqual({
      trusted: false,
      reason: "unknown_issuer",
    });
  });

  it("refuses a mandate that exceeds the issuer's grant, in full", () => {
    // Not partially honoured: the credential as presented is not one the
    // issuer was entitled to write.
    const d = decideTrust(ISSUERS[0].iss, ["read:transactions", "payment:initiate"]);
    expect(d).toEqual({ trusted: false, reason: "scope_not_granted", scope: "payment:initiate" });
  });

  it("stops honouring a suspended issuer even though its signatures still verify", async () => {
    const suspended: RegisteredIssuer = { ...ISSUERS[0], status: "suspended" };
    const original = ISSUERS[0];
    ISSUERS[0] = suspended;
    try {
      expect(decideTrust(suspended.iss, ["read:transactions"])).toEqual({
        trusted: false,
        reason: "suspended",
      });
      // The signature is still perfectly valid — which is exactly why trust
      // has to be a separate decision from verification.
      const token = await issueMandate(
        {
          jti: "m1",
          issuer: suspended.iss,
          audience: "bank:x",
          subject: "u1",
          principal: { name: "A" },
          scopes: ["read:transactions"],
          market: "IL",
          statement: "s",
        },
        key,
      );
      await expect(
        jwtVerify(token, await importJWK(await publicJwkFor(key), "EdDSA"), { audience: "bank:x" }),
      ).resolves.toBeTruthy();
    } finally {
      ISSUERS[0] = original;
    }
  });
});

describe("the published registry document", () => {
  it("states the permanently forbidden scopes, so nobody has to audit us", () => {
    const doc = registryDocument();
    expect(doc.forbiddenScopes).toEqual(FORBIDDEN_SCOPES);
    expect(doc.forbiddenScopes).toContain("payment:initiate");
  });

  it("publishes the discovery URIs an institution needs and nothing personal", () => {
    const doc = registryDocument();
    for (const i of doc.issuers) {
      expect(i.jwks_uri).toMatch(/^https:\/\//);
      expect(i.status_list_uri).toMatch(/^https:\/\//);
      expect(Object.keys(i).sort()).not.toContain("email");
    }
    expect(JSON.stringify(doc)).not.toMatch(/@|phone|passwordHash/i);
  });
});
