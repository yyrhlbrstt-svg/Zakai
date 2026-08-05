import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const store = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (store.has(name) ? { value: store.get(name)! } : undefined),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),
}));

const SECRET = "zakai-insecure-development-only-secret-do-not-use-in-production";

describe("session", () => {
  beforeEach(() => {
    store.clear();
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a real session", async () => {
    const { createSession, getSessionUserId } = await import("./session");
    await createSession("user_1");
    await expect(getSessionUserId()).resolves.toBe("user_1");
  });

  it(
    "rejects a scoped token from another flow (ownership magic link / proposed-saving " +
      "confirm) even though it's signed with the same secret and carries a userId — those " +
      "tokens are routinely forwarded by email and must never work as a login session",
    async () => {
      const { getSessionUserId } = await import("./session");
      const foreignToken = await new SignJWT({
        purpose: "ownership",
        userId: "victim_user",
        caseId: "some_case",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(new TextEncoder().encode(SECRET));
      store.set("zakai_session", foreignToken);
      await expect(getSessionUserId()).resolves.toBeNull();
    },
  );

  it("rejects a token with no purpose claim at all", async () => {
    const { getSessionUserId } = await import("./session");
    const bareToken = await new SignJWT({ userId: "victim_user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode(SECRET));
    store.set("zakai_session", bareToken);
    await expect(getSessionUserId()).resolves.toBeNull();
  });

  it("returns null with no cookie", async () => {
    const { getSessionUserId } = await import("./session");
    await expect(getSessionUserId()).resolves.toBeNull();
  });
});
