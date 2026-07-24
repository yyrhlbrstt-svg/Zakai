import { describe, it, expect } from "vitest";
import { clientIp } from "./ratelimit";

function req(headers: Record<string, string>): Request {
  return new Request("https://zakai.example/api/x", { headers });
}

describe("clientIp — spoofing resistance", () => {
  it("prefers the platform-set x-real-ip over x-forwarded-for", () => {
    const r = req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1, 203.0.113.9" });
    expect(clientIp(r)).toBe("203.0.113.9");
  });

  it("does NOT key on the spoofable leftmost x-forwarded-for value", () => {
    // Attacker prepends a forged IP; the edge appends the real one after it.
    const r = req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIp(r)).not.toBe("6.6.6.6");
    expect(clientIp(r)).toBe("203.0.113.9"); // last (trusted) hop
  });

  it("handles a single x-forwarded-for value", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to 'unknown' when no proxy headers are present", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("a rotating forged leftmost IP maps to the same real IP (no bypass)", () => {
    const a = clientIp(req({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" }));
    const b = clientIp(req({ "x-forwarded-for": "10.0.0.2, 203.0.113.9" }));
    expect(a).toBe(b); // the attacker can't get a fresh bucket per request
  });
});
