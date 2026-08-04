/**
 * Ratchet: incomplete/mock payments must not look "ok" in preflight.
 * Complete PayPlus keys auto-heal mock → live (CEO revenue unlock).
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const script = join(root, "scripts/preflight.mjs");

function runPreflight(extraEnv: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    DATABASE_URL: "postgres://local/test",
    AUTH_SECRET: "test-auth-secret",
    MANDATE_SIGNING_JWK: '{"kty":"OKP"}',
    MANDATE_SIGNING_KID: "test",
    CRON_SECRET: "cron",
    // Clear inherited PayPlus keys unless the test sets them.
    PAYPLUS_API_KEY: "",
    PAYPLUS_SECRET_KEY: "",
    PAYPLUS_PAYMENT_PAGE_UID: "",
    FORCE_MOCK_PAYMENTS: "",
    PAYMENT_PROVIDER: "mock",
    ...extraEnv,
  };
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: env as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
}

describe("preflight payments honesty", () => {
  it("marks mock PAYMENT_PROVIDER as not ok and prints FEES: MOCK", () => {
    const out = runPreflight({
      PAYMENT_PROVIDER: "mock",
      FORCE_MOCK_PAYMENTS: "true",
    });
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/FEES: MOCK/);
    expect(out.stdout).toMatch(/✗ PAYMENT_PROVIDER/);
  });

  it("requires complete PayPlus keys when PAYMENT_PROVIDER=payplus", () => {
    const incomplete = runPreflight({
      PAYMENT_PROVIDER: "payplus",
      PAYPLUS_API_KEY: "k",
    });
    expect(incomplete.stdout).toMatch(/FEES: MOCK/);
    expect(incomplete.stdout).toMatch(/✗ PAYMENT_PROVIDER/);

    const live = runPreflight({
      PAYMENT_PROVIDER: "payplus",
      PAYPLUS_API_KEY: "k",
      PAYPLUS_SECRET_KEY: "s",
      PAYPLUS_PAYMENT_PAGE_UID: "uid",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p",
      SMTP_FROM: "Zakai <u@example.com>",
    });
    expect(live.stdout).not.toMatch(/FEES: MOCK/);
    expect(live.stdout).toMatch(/✓ PAYMENT_PROVIDER/);
  });

  it("auto-heals mock to live when PayPlus keys are complete", () => {
    const out = runPreflight({
      PAYMENT_PROVIDER: "mock",
      PAYPLUS_API_KEY: "k",
      PAYPLUS_SECRET_KEY: "s",
      PAYPLUS_PAYMENT_PAGE_UID: "uid",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p",
      SMTP_FROM: "Zakai <u@example.com>",
    });
    expect(out.stdout).not.toMatch(/FEES: MOCK/);
    expect(out.stdout).toMatch(/✓ PAYMENT_PROVIDER/);
  });
});
