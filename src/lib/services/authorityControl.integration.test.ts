import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { revokeAllAuthorities, revokeAuthority, listAuthorities } from "./authorityControl";

/** Needs a real database. Skipped, not failed, when DATABASE_URL is absent. */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

async function makeUser(tag: string) {
  return prisma.user.create({
    data: {
      email: `authority-${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "Authority Tester",
      phone: "+972500000000",
      passwordHash: "x",
    },
    select: { id: true },
  });
}

async function makeActiveAuthority(userId: string, tag: string) {
  const kase = await prisma.case.create({
    data: { userId, provider: `provider-${tag}`, amountOriginal: 10_000, targetAmount: 8_000 },
  });
  const code = `ZK-${tag.slice(0, 4).toUpperCase()}-TEST`;
  await prisma.authorization.create({
    data: {
      caseId: kase.id,
      code,
      principalName: "Authority Tester",
      principalPhone: "+972500000000",
      principalEmail: "authority-test@zakai.test",
      provider: `provider-${tag}`,
      scope: "test scope",
    },
  });
  return code;
}

suite("revokeAllAuthorities", () => {
  it("revokes every active authority for the user in one call", async () => {
    const user = await makeUser("all");
    const codes = await Promise.all([
      makeActiveAuthority(user.id, `a${Date.now()}`),
      makeActiveAuthority(user.id, `b${Date.now()}`),
      makeActiveAuthority(user.id, `c${Date.now()}`),
    ]);

    const result = await revokeAllAuthorities(user.id);
    expect(result.revoked.sort()).toEqual([...codes].sort());
    expect(result.failed).toEqual([]);

    const all = await listAuthorities(user.id);
    expect(all.every((a) => a.status === "REVOKED")).toBe(true);
  });

  it("publishes a revocation for every one, not just the first", async () => {
    // The whole point: an institution's cached status list must reflect all
    // of them, not just whichever one the loop happened to process first.
    const user = await makeUser("publish");
    const codes = await Promise.all([
      makeActiveAuthority(user.id, `x${Date.now()}`),
      makeActiveAuthority(user.id, `y${Date.now()}`),
    ]);
    await revokeAllAuthorities(user.id);

    for (const code of codes) {
      const revocation = await prisma.mandateRevocation.findUnique({ where: { jti: code } });
      expect(revocation).not.toBeNull();
    }
  });

  it("does nothing destructive when there is nothing active to revoke", async () => {
    const user = await makeUser("empty");
    const result = await revokeAllAuthorities(user.id);
    expect(result).toEqual({ revoked: [], failed: [] });
  });

  it("leaves an already-revoked authority alone rather than erroring", async () => {
    const user = await makeUser("mixed");
    const code = await makeActiveAuthority(user.id, `already${Date.now()}`);
    await revokeAuthority(user.id, code);

    const result = await revokeAllAuthorities(user.id);
    // Nothing was active, so there was nothing for the bulk call to touch —
    // and touching an already-revoked one must never surface as a failure.
    expect(result.revoked).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("never touches another user's authority", async () => {
    const mine = await makeUser("mine");
    const theirs = await makeUser("theirs");
    const theirCode = await makeActiveAuthority(theirs.id, `theirs${Date.now()}`);

    await revokeAllAuthorities(mine.id);

    const untouched = await prisma.authorization.findUnique({ where: { code: theirCode } });
    expect(untouched?.status).toBe("ACTIVE");
  });
});
