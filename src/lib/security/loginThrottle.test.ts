import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rateLimitMock = vi.fn();
const refundMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...a),
  refundRateLimit: (...a: unknown[]) => refundMock(...a),
}));

import {
  accountKey,
  claimLoginAttempt,
  releaseLoginAttempt,
  ACCOUNT_ATTEMPT_LIMIT,
  ACCOUNT_WINDOW_SECONDS,
} from "./loginThrottle";

beforeEach(() => {
  rateLimitMock.mockReset().mockResolvedValue({ ok: true, remaining: 9 });
  refundMock.mockReset().mockResolvedValue(undefined);
  process.env.AUTH_SECRET = "a-test-secret-at-least-32-characters!";
});
afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("accountKey", () => {
  it("never contains the address it is derived from", () => {
    // The key becomes a RateLimit primary key. A table nobody thinks of as
    // personal data is exactly where personal data goes unnoticed.
    const key = accountKey("Someone@Example.COM");
    expect(key).not.toContain("Someone");
    expect(key).not.toContain("example");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("treats case and surrounding space as the same account", () => {
    // Otherwise "  Me@x.com " gets a fresh budget from the same login form.
    expect(accountKey("  Me@X.com ")).toBe(accountKey("me@x.com"));
  });

  it("gives different accounts different budgets", () => {
    expect(accountKey("a@x.com")).not.toBe(accountKey("b@x.com"));
  });

  it("is salted, so the same address differs between deployments", () => {
    const here = accountKey("a@x.com");
    process.env.AUTH_SECRET = "a-different-secret-also-32-chars-long";
    expect(accountKey("a@x.com")).not.toBe(here);
  });

  it("still produces a key with no AUTH_SECRET rather than refusing to throttle", () => {
    delete process.env.AUTH_SECRET;
    expect(accountKey("a@x.com")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("claimLoginAttempt", () => {
  it("spends from a per-account bucket, not a per-IP one", async () => {
    await claimLoginAttempt("a@x.com");
    const [bucket, identifier, limit, window] = rateLimitMock.mock.calls[0];
    expect(bucket).toBe("login-account");
    expect(identifier).toBe(accountKey("a@x.com"));
    expect(limit).toBe(ACCOUNT_ATTEMPT_LIMIT);
    expect(window).toBe(ACCOUNT_WINDOW_SECONDS);
  });

  it("reports exhaustion when the budget is gone", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0 });
    expect(await claimLoginAttempt("a@x.com")).toEqual({ ok: false });
  });

  it("spends against an address whether or not an account exists", async () => {
    // It cannot know, and must not: a budget that only applied to real
    // accounts would answer the enumeration question by its own behaviour.
    await claimLoginAttempt("definitely-not-a-user@x.com");
    expect(rateLimitMock).toHaveBeenCalledTimes(1);
  });
});

describe("releaseLoginAttempt", () => {
  it("refunds the same key it spent, so daily logins never accumulate", async () => {
    await releaseLoginAttempt("a@x.com");
    const [bucket, identifier, window] = refundMock.mock.calls[0];
    expect(bucket).toBe("login-account");
    expect(identifier).toBe(accountKey("a@x.com"));
    expect(window).toBe(ACCOUNT_WINDOW_SECONDS);
  });
});

describe("the window recovers on its own", () => {
  it("is bounded, so the control cannot become the denial of service", () => {
    // A lockout needing a human to clear it lets anybody who knows an address
    // lock its owner out on demand.
    expect(ACCOUNT_WINDOW_SECONDS).toBeGreaterThan(0);
    expect(ACCOUNT_WINDOW_SECONDS).toBeLessThanOrEqual(60 * 60);
    expect(ACCOUNT_ATTEMPT_LIMIT).toBeGreaterThanOrEqual(5);
  });
});
