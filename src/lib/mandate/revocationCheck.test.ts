import { describe, expect, it, vi } from "vitest";
import { resolveRevocationState } from "./revocationCheck";

describe("resolveRevocationState", () => {
  it("uses live lookup when the token has no status claim", async () => {
    const liveLookup = vi.fn().mockResolvedValue("active");
    const result = await resolveRevocationState({
      jti: "jti-1",
      issuer: "https://zakai.example",
      jwksUri: "https://zakai.example/.well-known/zakai-jwks.json",
      liveLookup,
    });
    expect(result).toEqual({ state: "active", via: "live_status" });
    expect(liveLookup).toHaveBeenCalledWith("jti-1");
  });

  it("prefers status list when zkm.status is present and definite", async () => {
    const liveLookup = vi.fn().mockResolvedValue("active");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    // List unreachable → fall back to live
    const fallback = await resolveRevocationState({
      jti: "jti-1",
      status: { idx: 3, uri: "https://zakai.example/api/mandate/revocations" },
      issuer: "https://zakai.example",
      jwksUri: "https://zakai.example/.well-known/zakai-jwks.json",
      liveLookup,
    });
    expect(fallback.via).toBe("live_status");
    expect(fallback.state).toBe("active");
    vi.unstubAllGlobals();
  });
});
