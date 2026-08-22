import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { register } from "./instrumentation";

/**
 * The guard exists because the failure it prevents is invisible: an emailed
 * magic link pointing at localhost produces no error, no failed Outbox row and
 * no log line — only a user whose one attempt quietly did nothing. These tests
 * are therefore about *when* it refuses to boot, not about the message text.
 */
const KEYS = ["NODE_ENV", "VERCEL_ENV", "NEXT_RUNTIME", "NEXT_PUBLIC_APP_URL"];

/**
 * NODE_ENV is declared readonly by @types/node but is an ordinary writable
 * property at runtime. Going through one widened alias is the only way to
 * exercise a production-only guard from a test process, and keeping it in a
 * single place stops the cast spreading through every case below.
 */
const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, env[k]]));
  env.NEXT_RUNTIME = "nodejs";
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
});

function setEnv(nodeEnv: string, vercelEnv?: string, appUrl?: string) {
  env.NODE_ENV = nodeEnv;
  if (vercelEnv === undefined) delete env.VERCEL_ENV;
  else env.VERCEL_ENV = vercelEnv;
  if (appUrl === undefined) delete env.NEXT_PUBLIC_APP_URL;
  else env.NEXT_PUBLIC_APP_URL = appUrl;
}

describe("register — production must be able to address itself", () => {
  it("refuses to boot a production deployment with no NEXT_PUBLIC_APP_URL", async () => {
    setEnv("production", "production", undefined);
    await expect(register()).rejects.toThrow(/NEXT_PUBLIC_APP_URL is not set/);
  });

  it("boots when a real origin is configured", async () => {
    setEnv("production", "production", "https://zakai-3uxj.vercel.app");
    await expect(register()).resolves.toBeUndefined();
  });

  it("rejects a hostname with no scheme, which breaks links just as silently", async () => {
    setEnv("production", "production", "zakai-3uxj.vercel.app");
    await expect(register()).rejects.toThrow(/not an absolute URL/);
  });

  it("rejects localhost in production — every emailed link would be dead", async () => {
    setEnv("production", "production", "http://localhost:3000");
    await expect(register()).rejects.toThrow(/points at localhost/);
  });

  it("rejects a non-http scheme", async () => {
    setEnv("production", "production", "ftp://zakai-3uxj.vercel.app");
    await expect(register()).rejects.toThrow(/must be an http\(s\) URL/);
  });

  it("leaves Vercel previews alone — they are built with NODE_ENV=production too", async () => {
    // Crashing a preview that never had the variable would trade a silent bug
    // in production for a loud one where no real mail is ever sent.
    setEnv("production", "preview", undefined);
    await expect(register()).resolves.toBeUndefined();
  });

  it("leaves local development alone", async () => {
    setEnv("development", undefined, undefined);
    await expect(register()).resolves.toBeUndefined();
  });

  it("says nothing twice — the edge runtime invocation is a no-op", async () => {
    setEnv("production", "production", undefined);
    env.NEXT_RUNTIME = "edge";
    await expect(register()).resolves.toBeUndefined();
  });
});
