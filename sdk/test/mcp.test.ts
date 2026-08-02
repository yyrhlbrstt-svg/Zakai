import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK, type JWK } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { issueMandate, publicJwkFor, type SigningKey } from "../src/mandate.js";
import { createMandateMcpServer } from "../src/mcp.js";

/**
 * The MCP surface is what a third-party agent platform actually touches, so
 * it is tested the way one would use it: a real MCP client over a real
 * (in-memory) transport, a genuinely issued Ed25519 mandate, and the JWKS +
 * revocation status served by a stubbed fetch standing in for the public
 * endpoints. No shortcuts through the tool handlers.
 */

async function connectedClient() {
  const server = createMandateMcpServer({ baseUrl: "https://issuer.test" });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function issueTestMandate() {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const key: SigningKey = { kid: "mcp-test-key", privateJwk: await exportJWK(privateKey) };
  const token = await issueMandate(
    {
      jti: "mcp-test-jti-0001",
      issuer: "https://issuer.test",
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

function stubPublicEndpoints(publicJwk: JWK, status: "active" | "revoked" | "down") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
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
      throw new Error(`unexpected fetch in test: ${url}`);
    }),
  );
}

function firstText(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const content = result.content as { type: string; text: string }[];
  expect(content[0]?.type).toBe("text");
  return JSON.parse(content[0].text);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("zakai-mandate MCP server", () => {
  it("exposes exactly the verification-only tool set", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "check_revocation",
      "decide_action",
      "list_scopes",
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

  it("verifies a genuinely issued mandate end to end", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, "active");
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "verify_mandate",
        arguments: { token, audience: "acme-bank" },
      }),
    ) as { ok: boolean; claims: { jti: string; scopes: string[] } };
    expect(payload.ok).toBe(true);
    expect(payload.claims.jti).toBe("mcp-test-jti-0001");
    expect(payload.claims.scopes).toEqual(["contract:cancel", "dispute:charge"]);
  });

  it("rejects the same mandate for the wrong audience", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, "active");
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

  it("decide_action permits a confirmed act on an active mandate", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, "active");
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
    stubPublicEndpoints(publicJwk, "revoked");
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "decide_action",
        arguments: {
          token,
          audience: "acme-bank",
          action: "contract:cancel",
          actConfirmation: "ref",
        },
      }),
    ) as { ok: boolean; decision: { decision: string; reason: string } };
    expect(payload.decision.decision).toBe("deny");
    expect(payload.decision.reason).toBe("revoked");
  });

  it("fails closed when the status endpoint is unreachable", async () => {
    const { token, publicJwk } = await issueTestMandate();
    stubPublicEndpoints(publicJwk, "down");
    const client = await connectedClient();

    const payload = firstText(
      await client.callTool({
        name: "decide_action",
        arguments: {
          token,
          audience: "acme-bank",
          action: "contract:cancel",
          actConfirmation: "ref",
        },
      }),
    ) as { ok: boolean; decision: { decision: string; reason: string } };
    expect(payload.decision.decision).toBe("deny");
    expect(payload.decision.reason).toBe("revocation_unknown");
  });
});
