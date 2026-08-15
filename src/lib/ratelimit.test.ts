import { describe, expect, it } from "vitest";
import { clientIp, clientIpFromHeaders } from "./ratelimit";

function req(headers: Record<string, string>): Request {
  return new Request("https://zakai.example/test", { headers });
}

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to the last hop of x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("returns unknown with no IP headers", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("clientIpFromHeaders", () => {
  it("matches clientIp's extraction given the same headers", () => {
    const headers = req({ "x-forwarded-for": "9.9.9.9" }).headers;
    expect(clientIpFromHeaders(headers)).toBe("9.9.9.9");
  });
});
