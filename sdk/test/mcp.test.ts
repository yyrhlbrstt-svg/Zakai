import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK, type JWK } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { clearJwksCache, issueMandate, publicJwkFor, type SigningKey } from "../src/mandate.js";
import { createMandateMcpServer } from "../src/mcp.js";

/**
 * The MCP surface is what a third-party agent platform actually touches, so
 * it is tested the way one would use it: a real MCP client over a real
 * (in-memory) transport, a genuinely issued Ed25519 mandate, and the trust
 * registry + JWKS + revocation status served by a stubbed fetch standing in
 * for the public endpoints. No shortcuts through the tool handlers.
 */

const ISSUER = "https://issuer.test";

async function connectedClient(oracleApiKey?: string) {
  const server = createMandateMcpServer({ baseUrl: ISSUER, oracleApiKey });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function issueTestMandate(overrides: { issuer?: string } = {}) {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const key: SigningKey = { kid: "mcp-test-key", privateJwk: await exportJWK(privateKey) };
  const token = await issueMandate(
    {
      jti: "mcp-test-jti-0001",
      issuer: overrides.issuer ?? ISSUER,
      audience: "acme-bank",
      subject: "user-42",
      principal: { name: "Test Principal" },
      scopes: ["contract:cancel", "dispute:charge"],
      market: "IL",
      statement: "Cancel my subscription.",
    },
    key,
  );
  const publicJwk = (await publicJwkFor(key)) as JWK & { kid?: string };
  return { token, publicJwk };
}

interface StubOptions {
  status?: "active" | "revoked" | "down";
  /** Issuer entry overrides in the served registry. */
  issuerStatus?: "active" | "suspended";
  allowedScopes?: string[];
  oracle?: { probability: number };
}

function stubPublicEndpoints(publicJwk: JWK, opts: StubOptions = {}) {
  const { status = "active", issuerStatus = "active" } = opts;
  const allowedScopes = opts.allowedScopes ?? [
    "contract:cancel",
    "dispute:charge",
    "negotiate:tariff",
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/.well-known/zakai-trust-registry.json")) {
        return new Response(
          JSON.stringify({
            version: 1,
            updated: "2026-08-02",
            forbiddenScopes: ["payment:initiate"],
            issuers: [
              {
                iss: ISSUER,
                name: "Test Issuer",
                jwks_uri: `${ISSUER}/.well-known/zakai-jwks.json`,
                status_list_uri: `${ISSUER}/api/mandate/revocations`,
                allowed_scopes: allowedScopes,
                status: issuerStatus,
                admitted_at: "2026-07-01",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/.well-known/zakai-jwks.json")) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/mandate/status/")) {
        if (status === "down") return new Response("nope", { status: 503 });
        return new Response(
          JSON.stringify(
            status === "revoked"
              ? { jti: "mcp-test-jti-0001", status: "revoked", revokedAt: "2026-08-01T00:00:00Z" }
              : { jti: "mcp-test-jti-0001", status: "active" },
          ),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/oracle/predict")) {
        return new Response(JSON.stringify(opts.oracle ?? { probability: 0.7, confident: true }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/pipe/handoff") && !url.endsWith("/api/pipe")) {
        return new Response(
          JSON.stringify({
            ok: true,
            url: `${ISSUER}/he/money?utm_source=agent`,
            pipe: "zakai-pipe",
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/pipe/accept")) {
        return new Response(
          JSON.stringify({ ok: true, accepted: true, decision: "permit" }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/api/pipe") || url.includes("/api/pipe?")) {
        return new Response(
          JSON.stringify({ ok: true, spec: "zakai-pipe", doors: ["money"] }),
          { headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    }),
  );
}

function firstText(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const content = result.content as { type: string; text: string }[];
  expect(content[0]?.type).toBe("text");
  return JSON.parse(content[0].text);
}

beforeEach(() => {
  // verifyMandateFromUrl caches JWKS — each test issues a fresh keypair.
  clearJwksCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearJwksCache();
});

describe("zakai-mandate MCP server", () => {
  it("exposes verify + pipe discovery/handoff/accept — never issuance", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "check_revocation",
      "decide_action",
      "discover_pipe",
      "get_trust_registry",
      "list_scopes",
      "pipe_accept",
      "pipe_handoff",
      "predict_outcome",
      "verify_mandate",
    ]);
    // No issuance surface, by design.
    expect(tools.some((t) => /issue|sign|create/.test(t.name))).toBe(false);
  });

  it("list_scopes returns the closed registry including the forbidden set", async () => {
    const client = await connectedClient();
    const payload = firstText(await client.callTool({ name: "list_scopes", arguments: {} })) as {
      ok: boolean;
      scopes: { scope: string }[];
      forbidden: string[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.scopes.map((s) => s.scope)).toContain("contract:cancel");
    expect(payload.forbidden).toContain("payment:initiate");
  });

  it("verifies a genuinely issued mandate through the trust registry", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk);
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; claims: { jti: string; scopes: string[] }; issuer: { iss: string; name: string } };
    expect(payload.ok).toBe(true);
    expect(payload.claims.jti).toBe("mcp-test-jti-0001");
    expect(payload.claims.scopes).toEqual(["contract:cancel", "dispute:charge"]);
    expect(payload.issuer).toEqual({ iss: ISSUER, name: "Test Issuer", status: "active" });
  });

  it("rejects an issuer that is not in the trust registry, before any cryptography", async () => {
    const { token, publicJwk } = await issueTestMandate({ issuer: "https://rogue.example" });
    stubPublicEndpoints(publicJwk);
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("UNKNOWN_ISSUER");
  });

  it("a suspended issuer's perfectly-signed mandate stops verifying immediately", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { issuerStatus: "suspended" });
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("ISSUER_SUSPENDED");
  });

  it("an issuer that granted beyond its registry entry poisons the whole mandate", async () => {
    const { token, publicJwk } = await issueTestMandate();
    // Registry says this issuer may only grant negotiate:tariff.
    stubPublicEndpoints(publicJwk, { allowedScopes: ["negotiate:tariff"] });
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("ISSUER_SCOPE_EXCEEDED");
  });

  it("rejects the same mandate for the wrong audience", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk);
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "someone-else" },
      }),
    ) as { ok: boolean; code: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("AUDIENCE_MISMATCH");
  });

  it("verify_mandate fails closed when the mandate is revoked", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { status: "revoked" });
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string; jti: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("REVOKED");
    expect(payload.jti).toBe("mcp-test-jti-0001");
  });

  it("verify_mandate fails closed when the status store is unreachable", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { status: "down" });
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("STATUS_UNKNOWN");
    expect(payload.error).toBe("revocation_unknown");
  });

  it("verify_mandate prefers the signed status list when zkm.status is embedded", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const key: SigningKey = { kid: "mcp-test-key", privateJwk: await exportJWK(privateKey) };
    const publicJwk = (await publicJwkFor(key)) as JWK & { kid?: string };
    const token = await issueMandate(
      {
        jti: "mcp-test-jti-0001",
        issuer: ISSUER,
        audience: "acme-bank",
        subject: "user-42",
        principal: { name: "Test Principal" },
        scopes: ["contract:cancel", "dispute:charge"],
        market: "IL",
        statement: "Cancel my subscription.",
        status: { idx: 1, uri: `${ISSUER}/api/mandate/revocations` },
      },
      key,
    );

    const { SignJWT } = await import("jose");
    const { gzipSync } = await import("node:zlib");
    const bytes = new Uint8Array(1);
    bytes[0] = 0b0000_0010; // index 1 revoked
    const lst = Buffer.from(gzipSync(Buffer.from(bytes))).toString("base64url");
    const listToken = await new SignJWT({
      iss: ISSUER,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      status_list: { bits: 1, lst },
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "statuslist+jwt", kid: key.kid })
      .sign(await (await import("jose")).importJWK(key.privateJwk, "EdDSA"));

    // Live status would say active — list must win.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/.well-known/zakai-trust-registry.json")) {
          return new Response(
            JSON.stringify({
              version: 1,
              updated: "2026-08-02",
              forbiddenScopes: ["payment:initiate"],
              issuers: [
                {
                  iss: ISSUER,
                  name: "Test Issuer",
                  jwks_uri: `${ISSUER}/.well-known/zakai-jwks.json`,
                  status_list_uri: `${ISSUER}/api/mandate/revocations`,
                  allowed_scopes: ["contract:cancel", "dispute:charge", "negotiate:tariff"],
                  status: "active",
                  admitted_at: "2026-07-01",
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/.well-known/zakai-jwks.json")) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), {
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/mandate/revocations")) {
          return new Response(listToken, { headers: { "content-type": "application/statuslist+jwt" } });
        }
        if (url.includes("/api/mandate/status/")) {
          return new Response(JSON.stringify({ jti: "mcp-test-jti-0001", status: "active" }), {
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`unexpected fetch in test: ${url}`);
      }),
    );

    const client = await connectedClient();
    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string; via: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("REVOKED");
    expect(payload.via).toBe("status_list");
  });

  it("verify_mandate fails closed when zkm.status list is down — never uses live active", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const key: SigningKey = { kid: "mcp-test-key", privateJwk: await exportJWK(privateKey) };
    const publicJwk = (await publicJwkFor(key)) as JWK & { kid?: string };
    const token = await issueMandate(
      {
        jti: "mcp-test-jti-0001",
        issuer: ISSUER,
        audience: "acme-bank",
        subject: "user-42",
        principal: { name: "Test Principal" },
        scopes: ["contract:cancel", "dispute:charge"],
        market: "IL",
        statement: "Cancel my subscription.",
        status: { idx: 1, uri: `${ISSUER}/api/mandate/revocations` },
      },
      key,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/.well-known/zakai-trust-registry.json")) {
          return new Response(
            JSON.stringify({
              version: 1,
              updated: "2026-08-02",
              forbiddenScopes: ["payment:initiate"],
              issuers: [
                {
                  iss: ISSUER,
                  name: "Test Issuer",
                  jwks_uri: `${ISSUER}/.well-known/zakai-jwks.json`,
                  status_list_uri: `${ISSUER}/api/mandate/revocations`,
                  allowed_scopes: ["contract:cancel", "dispute:charge", "negotiate:tariff"],
                  status: "active",
                  admitted_at: "2026-07-01",
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/.well-known/zakai-jwks.json")) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), {
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/mandate/revocations")) {
          return new Response("down", { status: 503 });
        }
        if (url.includes("/api/mandate/status/")) {
          return new Response(JSON.stringify({ jti: "mcp-test-jti-0001", status: "active" }), {
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`unexpected fetch in test: ${url}`);
      }),
    );

    const client = await connectedClient();
    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; code: string; via: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("STATUS_UNKNOWN");
    expect(payload.via).toBe("status_list");
  });

  it("check_revocation returns ok only for definite active/revoked answers", async () => {
    const { publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { status: "active" });
    const client = await connectedClient();

    const active = firstText(
      await client.callTool({
        name: "check_revocation",
        arguments: { jti: "mcp-test-jti-0001" },
      }),
    ) as { ok: boolean; state: string };
    expect(active.ok).toBe(true);
    expect(active.state).toBe("active");

    stubPublicEndpoints(publicJwk, { status: "revoked" });
    const revoked = firstText(
      await client.callTool({
        name: "check_revocation",
        arguments: { jti: "mcp-test-jti-0001" },
      }),
    ) as { ok: boolean; state: string };
    expect(revoked.ok).toBe(true);
    expect(revoked.state).toBe("revoked");

    stubPublicEndpoints(publicJwk, { status: "down" });
    const unknown = firstText(
      await client.callTool({
        name: "check_revocation",
        arguments: { jti: "mcp-test-jti-0001" },
      }),
    ) as { ok: boolean; code: string; state: string };
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe("STATUS_UNKNOWN");
    expect(unknown.state).toBe("unknown");
  });

  it("decide_action permits a confirmed act on an active mandate", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk);
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "decide_action",
        arguments: {
          token,
          audience: "acme-bank",
          action: "contract:cancel",
          actConfirmation: "user-clicked-cancel-ref-1",
        },
      }),
    ) as { ok: boolean; decision: { decision: string; obligations: string[] } };
    expect(payload.ok).toBe(true);
    expect(payload.decision.decision).toBe("permit");
    expect(payload.decision.obligations).toContain("record:mcp-test-jti-0001");
  });

  it("decide_action denies when the mandate is revoked", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { status: "revoked" });
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "decide_action",
        arguments: { token, audience: "acme-bank", action: "contract:cancel", actConfirmation: "ref" },
      }),
    ) as { decision: { decision: string; reason: string } };
    expect(payload.decision.decision).toBe("deny");
    expect(payload.decision.reason).toBe("revoked");
  });

  it("fails closed when the status endpoint is unreachable", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { status: "down" });
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "decide_action",
        arguments: { token, audience: "acme-bank", action: "contract:cancel", actConfirmation: "ref" },
      }),
    ) as { decision: { decision: string; reason: string } };
    expect(payload.decision.decision).toBe("deny");
    expect(payload.decision.reason).toBe("revocation_unknown");
  });

  it("get_trust_registry returns the normalised issuer list", async () => {
    const { publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk);
    const client = await connectedClient();

    const payload = firstText(await client.callTool({ name: "get_trust_registry", arguments: {} })) as {
      ok: boolean;
      registry: { issuers: { iss: string; allowedScopes: string[] }[]; forbiddenScopes: string[] };
    };
    expect(payload.ok).toBe(true);
    expect(payload.registry.issuers[0].iss).toBe(ISSUER);
    expect(payload.registry.issuers[0].allowedScopes).toContain("contract:cancel");
    expect(payload.registry.forbiddenScopes).toContain("payment:initiate");
  });

  it("predict_outcome refuses without an Oracle key and answers with one", async () => {
    const { publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, { oracle: { probability: 0.42 } });

    const noKey = await connectedClient();
    const refused = firstText(
      await noKey.callTool({
        name: "predict_outcome",
        arguments: { market: "IL", vertical: "subscription", counterparty: "yes" },
      }),
    ) as { ok: boolean; code: string };
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe("ORACLE_KEY_REQUIRED");

    const withKey = await connectedClient("oracle-key-123");
    const answered = firstText(
      await withKey.callTool({
        name: "predict_outcome",
        arguments: { market: "IL", vertical: "subscription", counterparty: "yes" },
      }),
    ) as { ok: boolean; prediction: { probability: number } };
    expect(answered.ok).toBe(true);
    expect(answered.prediction.probability).toBe(0.42);
  });
});
