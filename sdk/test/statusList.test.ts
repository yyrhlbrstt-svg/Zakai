import { afterEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { SignJWT, generateKeyPair, exportJWK, type JWK } from "jose";
import {
  readStatus,
  STATUS_LIST_TYPE,
  statusListRevocationState,
  verifyStatusList,
} from "../src/statusList.js";

describe("statusList client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads revoked bits from a packed list", () => {
    const bytes = new Uint8Array(2);
    bytes[0] = 0b0000_0010; // index 1 revoked
    const lst = Buffer.from(gzipSync(Buffer.from(bytes))).toString("base64url");
    expect(readStatus(lst, 0)).toBe(false);
    expect(readStatus(lst, 1)).toBe(true);
    expect(STATUS_LIST_TYPE).toBe("statuslist+jwt");
  });

  it("statusListRevocationState answers from a signed list", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const publicJwk = (await exportJWK(publicKey)) as JWK;
    const bytes = new Uint8Array(1);
    bytes[0] = 0b0000_0100; // index 2 revoked
    const lst = Buffer.from(gzipSync(Buffer.from(bytes))).toString("base64url");
    const token = await new SignJWT({
      iss: "https://issuer.test",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      status_list: { bits: 1, lst },
    })
      .setProtectedHeader({ alg: "EdDSA", typ: STATUS_LIST_TYPE })
      .sign(privateKey);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/revocations")) return new Response(token);
        if (url.includes("jwks")) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), {
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    await expect(
      statusListRevocationState(
        { idx: 2, uri: "https://issuer.test/api/mandate/revocations" },
        {
          issuer: "https://issuer.test",
          jwksUri: "https://issuer.test/.well-known/zakai-jwks.json",
        },
      ),
    ).resolves.toBe("revoked");

    await expect(
      statusListRevocationState(
        { idx: 0, uri: "https://issuer.test/api/mandate/revocations" },
        {
          issuer: "https://issuer.test",
          jwksUri: "https://issuer.test/.well-known/zakai-jwks.json",
          publicJwks: [publicJwk],
        },
      ),
    ).resolves.toBe("active");

    const verified = await verifyStatusList(token, {
      issuer: "https://issuer.test",
      publicJwks: [publicJwk],
    });
    expect(verified.isRevoked(2)).toBe(true);
  });

  it("statusListRevocationState fails closed on fetch errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(
      statusListRevocationState(
        { idx: 0, uri: "https://issuer.test/api/mandate/revocations" },
        {
          issuer: "https://issuer.test",
          jwksUri: "https://issuer.test/.well-known/zakai-jwks.json",
        },
      ),
    ).resolves.toBe("unknown");
  });
});
