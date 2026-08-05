import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  clearJwksCache,
  fetchJwksCached,
  DEFAULT_JWKS_CACHE_TTL_MS,
} from "../src/mandate.js";

describe("fetchJwksCached", () => {
  beforeEach(() => {
    clearJwksCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    clearJwksCache();
  });

  it("caches JWKS within the TTL", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({ keys: [{ kty: "OKP", crv: "Ed25519", x: "x", kid: "k1" }] }),
        };
      }),
    );

    const a = await fetchJwksCached("https://example.test/jwks", DEFAULT_JWKS_CACHE_TTL_MS, 1_000);
    const b = await fetchJwksCached("https://example.test/jwks", DEFAULT_JWKS_CACHE_TTL_MS, 1_000 + 60_000);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it("refetches after TTL expires", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({ keys: [{ kty: "OKP", crv: "Ed25519", x: "x", kid: `k${calls}` }] }),
        };
      }),
    );

    await fetchJwksCached("https://example.test/jwks", 1_000, 10_000);
    await fetchJwksCached("https://example.test/jwks", 1_000, 12_000);
    expect(calls).toBe(2);
  });
});
