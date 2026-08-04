import { describe, expect, it, afterEach } from "vitest";
import { evaluateConsumerReleaseGate, paymentsFullyLive } from "@/lib/deploy/releaseGate";

const snapshot = { ...process.env };

afterEach(() => {
  process.env = { ...snapshot };
});

describe("evaluateConsumerReleaseGate", () => {
  it("scores 100 only when all blocking and consumer checks pass", () => {
    process.env = {
      ...snapshot,
      NODE_ENV: "production",
      NEON_DATABASE_URL: "postgres://x",
      AUTH_SECRET: "secret",
      MANDATE_SIGNING_JWK: "{}",
      MANDATE_SIGNING_KID: "kid",
      CRON_SECRET: "cron",
      MANDATE_ISSUER: "https://zakai.example",
      NEXT_PUBLIC_APP_URL: "https://zakai.example",
      SMTP_HOST: "smtp.example",
      SMTP_USER: "u",
      SMTP_PASS: "p",
      SMTP_FROM: "Zakai <no-reply@zakai.example>",
      INBOUND_EMAIL_SECRET: "inbound",
      MANDATE_ISSUE_KEY: "issue",
      MANDATE_REVOKE_KEY: "revoke",
      PAYMENT_PROVIDER: "payplus",
      PAYPLUS_API_KEY: "k",
      PAYPLUS_SECRET_KEY: "s",
      PAYPLUS_PAYMENT_PAGE_UID: "page",
      ADMIN_EMAIL: "founder@zakai.example",
      ANTHROPIC_API_KEY: "sk",
      LEADS_EMAIL: "leads@zakai.example",
      SALES_EMAIL: "sales@zakai.example",
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
    };
    const r = evaluateConsumerReleaseGate();
    expect(r.releaseScore).toBe(100);
    expect(r.canReleaseConsumerApp).toBe(true);
    expect(r.failingIds).toEqual([]);
  });

  it("fails closed on mock payments", () => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.PAYPLUS_API_KEY;
    delete process.env.PAYPLUS_SECRET_KEY;
    delete process.env.PAYPLUS_PAYMENT_PAGE_UID;
    process.env.FORCE_MOCK_PAYMENTS = "true";
    expect(paymentsFullyLive()).toBe(false);
    const r = evaluateConsumerReleaseGate();
    expect(r.failingIds).toContain("payments_live");
  });

  it("auto-heals payments_live when PayPlus keys are complete under mock", () => {
    process.env.PAYMENT_PROVIDER = "mock";
    delete process.env.FORCE_MOCK_PAYMENTS;
    process.env.PAYPLUS_API_KEY = "k";
    process.env.PAYPLUS_SECRET_KEY = "s";
    process.env.PAYPLUS_PAYMENT_PAGE_UID = "page";
    expect(paymentsFullyLive()).toBe(true);
  });
});
