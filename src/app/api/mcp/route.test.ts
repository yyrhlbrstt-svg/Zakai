import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 100 }),
  clientIp: () => "127.0.0.1",
}));

import { POST, GET } from "./route";

function rpc(body: unknown) {
  return new Request("https://zakai.test/api/mcp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp", () => {
  it("rejects non-JSON-RPC bodies", async () => {
    const res = await POST(rpc({ hello: "world" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe(-32600);
  });

  it("handles initialize", async () => {
    const res = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.serverInfo.name).toBe("zakai");
    expect(data.result.capabilities).toEqual({ tools: {} });
  });

  it("returns 202 with no body for notifications", async () => {
    const res = await POST(rpc({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("lists tools", async () => {
    const res = await POST(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const data = await res.json();
    const names = data.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(["check_rights", "protocol_status"]);
    // Every tool must carry a valid JSON Schema input shape for MCP clients.
    for (const tool of data.result.tools) {
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("calls protocol_status and returns JSON text content", async () => {
    const res = await POST(
      rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "protocol_status", arguments: {} } }),
    );
    const data = await res.json();
    expect(data.result.isError).toBe(false);
    expect(data.result.content[0].type).toBe("text");
    const parsed = JSON.parse(data.result.content[0].text);
    expect(parsed).toHaveProperty("mandate_signing_live");
    expect(parsed).toHaveProperty("jwks");
  });

  it("calls check_rights and returns a catalog for IL", async () => {
    const res = await POST(
      rpc({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "check_rights", arguments: { market: "IL" } },
      }),
    );
    const data = await res.json();
    expect(data.result.isError).toBe(false);
    expect(data.result.content[0].type).toBe("text");
  });

  it("returns an error content block for an unknown tool", async () => {
    const res = await POST(
      rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nonexistent" } }),
    );
    const data = await res.json();
    expect(data.result.isError).toBe(true);
  });

  it("returns Method not found for an unknown method with an id", async () => {
    const res = await POST(rpc({ jsonrpc: "2.0", id: 6, method: "not/a/thing" }));
    const data = await res.json();
    expect(data.error.code).toBe(-32601);
  });
});

describe("GET /api/mcp", () => {
  it("rejects GET — stateless POST-only server", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
