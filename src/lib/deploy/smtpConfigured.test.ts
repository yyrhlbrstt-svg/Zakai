import { afterEach, describe, expect, it } from "vitest";
import { smtpFullyConfigured } from "./smtpConfigured";

const snapshot = { ...process.env };

afterEach(() => {
  process.env = { ...snapshot };
});

describe("smtpFullyConfigured", () => {
  it("rejects SMTP_HOST alone (incomplete transport)", () => {
    process.env = {
      ...snapshot,
      SMTP_HOST: "smtp.example.com",
    };
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    expect(smtpFullyConfigured()).toBe(false);
  });

  it("requires HOST + USER + PASS", () => {
    process.env = {
      ...snapshot,
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p",
    };
    expect(smtpFullyConfigured()).toBe(true);
  });

  it("treats whitespace-only as unset", () => {
    process.env = {
      ...snapshot,
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "  ",
      SMTP_PASS: "p",
    };
    expect(smtpFullyConfigured()).toBe(false);
  });
});
