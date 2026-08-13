import { describe, it, expect } from "vitest";
import { authSwitchHref, toolNameForReturnPath } from "@/lib/auth/returnReason";
import { CATALOG } from "@/lib/priority";

describe("toolNameForReturnPath", () => {
  it("names the tool a guest was sent away from", () => {
    expect(toolNameForReturnPath("/check", "he")).toBe(
      CATALOG.find((a) => a.id === "check")!.titleHe,
    );
    expect(toolNameForReturnPath("/check", "en")).toBe(
      CATALOG.find((a) => a.id === "check")!.titleEn,
    );
  });

  it("ignores a query string or hash", () => {
    // Verticals pass state through the return path — "/cancel?provider=hot"
    // is still the cancel tool, and dropping the whole line because of a
    // query parameter is the failure this test exists to prevent.
    const cancel = CATALOG.find((a) => a.id === "cancel")!;
    expect(toolNameForReturnPath("/cancel?provider=hot", "he")).toBe(cancel.titleHe);
    expect(toolNameForReturnPath("/cancel#form", "he")).toBe(cancel.titleHe);
    expect(toolNameForReturnPath("/cancel/", "he")).toBe(cancel.titleHe);
  });

  it("says nothing rather than something empty", () => {
    expect(toolNameForReturnPath(null, "he")).toBeNull();
    expect(toolNameForReturnPath("", "he")).toBeNull();
    expect(toolNameForReturnPath("/dashboard", "he")).toBeNull();
    expect(toolNameForReturnPath("/no-such-page", "he")).toBeNull();
  });

  it("never treats an off-site or protocol-relative path as a tool", () => {
    // The caller already validates this, but a helper that reads a name off
    // an attacker-supplied string is one refactor away from rendering it.
    expect(toolNameForReturnPath("https://evil.example/check", "he")).toBeNull();
    expect(toolNameForReturnPath("//evil.example/check", "he")).toBeNull();
    expect(toolNameForReturnPath("check", "he")).toBeNull();
  });

  it("falls back to the English name for locales the catalog does not carry", () => {
    const check = CATALOG.find((a) => a.id === "check")!;
    for (const locale of ["ar", "ru", "de", "fr"]) {
      expect(toolNameForReturnPath("/check", locale)).toBe(check.titleEn);
    }
  });
});

describe("authSwitchHref", () => {
  it("carries the errand across the login/signup switch", () => {
    // The whole point: somebody with no account taps "sign up" from a gated
    // tool and must land back on that tool afterwards.
    expect(authSwitchHref("login", "/check")).toBe("/signup?return=%2Fcheck");
    expect(authSwitchHref("signup", "/check")).toBe("/login?return=%2Fcheck");
  });

  it("encodes a return path that carries its own query", () => {
    expect(authSwitchHref("login", "/cancel?provider=hot")).toBe(
      "/signup?return=%2Fcancel%3Fprovider%3Dhot",
    );
  });

  it("stays bare when there is no errand", () => {
    expect(authSwitchHref("login", null)).toBe("/signup");
    expect(authSwitchHref("signup", null)).toBe("/login");
  });
});
