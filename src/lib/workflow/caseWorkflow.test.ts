import { describe, expect, it, vi, beforeEach } from "vitest";

/*
  The create mock is a plain function behind a swappable implementation, not a
  `vi.fn()` that throws.

  vitest records what a spy throws in `mock.results` and reports it as a test
  failure even when the code under test caught it correctly — verified here by
  a probe that printed the right return value and failed anyway. Recording
  calls by hand costs three lines and keeps the runner out of the branch being
  tested.
*/
const calls: Array<{ data: Record<string, unknown> }> = [];
let createImpl: (args: { data: Record<string, unknown> }) => Promise<unknown> = async () => ({});
const create = (args: { data: Record<string, unknown> }) => {
  calls.push(args);
  return createImpl(args);
};
vi.mock("@/lib/prisma", () => ({ prisma: { idempotencyRecord: { create } } }));
vi.mock("@/lib/events/spine", () => ({ recordEvent: vi.fn(async () => ({ ok: true, id: "e1" })) }));

const { claimResume, REPLY_WINDOW, APPROVAL_WINDOW } = await import("./caseWorkflow");

beforeEach(() => {
  calls.length = 0;
  createImpl = async () => ({});
});

describe("resume idempotency", () => {
  it("lets the first delivery through", async () => {
    expect(await claimResume("case-1", "institution-reply", "outbox-9")).toBe(true);
  });

  it("refuses the second delivery of the same cause", async () => {
    // A duplicate webhook is the normal case, not an error: the unique
    // constraint on (scope, actorId, key) is what stops a second resume, and
    // losing that race must read as "already handled", not as a crash.
    createImpl = async () => {
      throw Object.assign(new Error("unique constraint violated"), { code: "P2002" });
    };
    expect(await claimResume("case-1", "institution-reply", "outbox-9")).toBe(false);
  });

  it("scopes the claim per step, so a reply and an approval cannot collide", async () => {
    await claimResume("case-1", "institution-reply", "x");
    await claimResume("case-1", "mandate-approval", "x");
    const scopes = calls.map((c) => c.data.scope);
    expect(new Set(scopes).size).toBe(2);
  });

  it("keys on the cause, not the case, so two real replies both land", async () => {
    await claimResume("case-1", "institution-reply", "outbox-1");
    await claimResume("case-1", "institution-reply", "outbox-2");
    const keys = calls.map((c) => c.data.key);
    expect(keys).toEqual(["outbox-1", "outbox-2"]);
  });

  it("holds the claim longer than the longest wait it guards", async () => {
    await claimResume("case-1", "institution-reply", "outbox-1");
    const { expiresAt } = calls[0].data as { expiresAt: Date };
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
    // 14d reply window + 7d approval window, with room to spare — otherwise a
    // duplicate could slip through after the record expired.
    expect(days).toBeGreaterThan(21);
  });
});

describe("every wait is bounded", () => {
  it("states both windows explicitly", () => {
    expect(REPLY_WINDOW).toBe("14d");
    expect(APPROVAL_WINDOW).toBe("7d");
  });
});
