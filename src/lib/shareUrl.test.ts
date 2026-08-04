import { describe, expect, it } from "vitest";
import { buildShareLandingUrl } from "./shareUrl";

describe("buildShareLandingUrl", () => {
  const origin = "https://zakai.test";

  it("builds share card URL with amount and ref", () => {
    const url = buildShareLandingUrl({
      origin,
      locale: "he",
      amountLabel: "₪450",
      kicker: "חשמל",
      referralCode: "abc",
    });
    expect(url).toBe(
      "https://zakai.test/he/share?amount=%E2%82%AA450&kicker=%D7%97%D7%A9%D7%9E%D7%9C&ref=abc",
    );
  });

  it("falls back to signup ref without amount", () => {
    expect(
      buildShareLandingUrl({ origin, locale: "en", referralCode: "x" }),
    ).toBe("https://zakai.test/signup?ref=x");
  });

  it("falls back to locale home", () => {
    expect(buildShareLandingUrl({ origin, locale: "he" })).toBe(
      "https://zakai.test/he",
    );
  });
});
