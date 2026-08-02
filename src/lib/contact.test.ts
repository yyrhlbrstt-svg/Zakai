import { describe, it, expect, afterEach } from "vitest";
import { FOUNDER_EMAIL, publicSupportEmail, publicSecurityEmail } from "./contact";

describe("contact", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("never returns a .example support inbox when env is unset", () => {
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    expect(publicSupportEmail()).toBe(FOUNDER_EMAIL);
    expect(publicSupportEmail()).not.toContain(".example");
  });

  it("rejects placeholder domains even when set in env", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@zakai.example";
    expect(publicSupportEmail()).toBe(FOUNDER_EMAIL);
  });

  it("uses a real configured support address", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@real-domain.co.il";
    expect(publicSupportEmail()).toBe("help@real-domain.co.il");
  });

  it("security email follows the same floor", () => {
    delete process.env.NEXT_PUBLIC_SECURITY_EMAIL;
    expect(publicSecurityEmail()).toBe(FOUNDER_EMAIL);
  });
});
