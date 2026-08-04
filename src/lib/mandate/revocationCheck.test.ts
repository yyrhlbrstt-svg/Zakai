import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveRevocationState } from "./revocationCheck";

describe("resolveRevocationState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("fails closed on status-list unknown — never falls back to live", async () => {
    const liveLookup = vi.fn().mockResolvedValue("active");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    const result = await resolveRevocationState({
      jti: "jti-1",
      status: { idx: 3, uri: "https://zakai.example/api/mandate/revocations" },
      issuer: "https://zakai.example",
      jwksUri: "https://zakai.example/.well-known/zakai-jwks.json",
      liveLookup,
    });
    expect(result).toEqual({ state: "unknown", via: "status_list" });
    expect(liveLookup).not.toHaveBeenCalled();
  });
});
