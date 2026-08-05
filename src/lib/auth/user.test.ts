import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const getSessionUserId = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

vi.mock("./session", () => ({
  getSessionUserId: (...args: unknown[]) => getSessionUserId(...args),
}));

import { getCurrentUser, requireUser, UnauthorizedError } from "./user";

describe("getCurrentUser", () => {
  beforeEach(() => {
    findUnique.mockReset();
    getSessionUserId.mockReset();
  });

  it("returns null without querying the DB when there is no session", async () => {
    getSessionUserId.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns the real user row for a valid session", async () => {
    getSessionUserId.mockResolvedValue("user_1");
    findUnique.mockResolvedValue({ id: "user_1", email: "a@b.com" });
    await expect(getCurrentUser()).resolves.toEqual({ id: "user_1", email: "a@b.com" });
  });

  it(
    "returns null (not a thrown error) when the DB is unreachable — this runs on every page " +
      "via the root layout, so throwing here would take the whole site down for anyone " +
      "carrying a session cookie",
    async () => {
      getSessionUserId.mockResolvedValue("user_1");
      findUnique.mockRejectedValue(new Error("db down"));
      await expect(getCurrentUser()).resolves.toBeNull();
    },
  );
});

describe("requireUser", () => {
  beforeEach(() => {
    findUnique.mockReset();
    getSessionUserId.mockReset();
  });

  it("throws UnauthorizedError when the DB is unreachable, same as a real logged-out request", async () => {
    getSessionUserId.mockResolvedValue("user_1");
    findUnique.mockRejectedValue(new Error("db down"));
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
