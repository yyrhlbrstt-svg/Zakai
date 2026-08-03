/**
 * Ratchet: PAYMENT_PROVIDER=mock must not look "ok" in preflight.
 * Spawns scripts/preflight.mjs with a controlled env.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const script = join(root, "scripts/preflight.mjs");

function runPreflight(extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: "postgres://local/test",
      AUTH_SECRET: "test-auth-secret",
      MANDATE_SIGNING_JWK: '{"kty":"OKP"}',
      MANDATE_SIGNING_KID: "test",
      CRON_SECRET: "cron",
      PAYMENT_PROVIDER: "mock",
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

describe("preflight payments honesty", () => {
  it("marks mock PAYMENT_PROVIDER as not ok and prints FEES: MOCK", () => {
    const out = runPreflight({ PAYMENT_PROVIDER: "mock" });
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
});
