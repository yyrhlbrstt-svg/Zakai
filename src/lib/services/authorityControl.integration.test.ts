import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { revokeAllAuthorities, revokeAuthority, listAuthorities } from "./authorityControl";

/** Needs a real database. Skipped, not failed, when DATABASE_URL is absent. */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

// Everything this suite creates is tracked and removed afterwards. It used to
// leave rows behind with codes derived from `Date.now()`'s leading digits —
// identical for months at a stretch — so the suite passed on a clean database
// and failed with a unique-constraint violation on every run after the first.
const createdUserIds: string[] = [];
const createdCodes: string[] = [];
const createdMandateJtis: string[] = [];

afterAll(async () => {
  if (!hasDb) return;
  await prisma.mandateRevocation.deleteMany({
    where: { jti: { in: [...createdCodes, ...createdMandateJtis] } },
  });
  // Cases and authorizations cascade from the user.
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function makeUser(tag: string) {
  const user = await prisma.user.create({
    data: {
      email: `authority-${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "Authority Tester",
      phone: "+972500000000",
      passwordHash: "x",
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeActiveAuthority(userId: string, tag: string) {
  const kase = await prisma.case.create({
    data: { userId, provider: `provider-${tag}`, amountOriginal: 10_000, targetAmount: 8_000 },
  });
  const code = `ZK-${tag.slice(0, 1).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 9)
    .toUpperCase()}-TEST`;
  // Machine jti institutions verify — distinct from the human ZK code.
  const mandateJti = crypto.randomUUID();
  createdCodes.push(code);
  createdMandateJtis.push(mandateJti);
  await prisma.authorization.create({
    data: {
      caseId: kase.id,
      code,
      principalName: "Authority Tester",
      principalPhone: "+972500000000",
      principalEmail: "authority-test@zakai.test",
      provider: `provider-${tag}`,
      scope: "test scope",
      mandateJti,
    },
  });
  return { code, mandateJti };
}

suite("revokeAllAuthorities", () => {
  it("revokes every active authority for the user in one call", async () => {
    const user = await makeUser("all");
    const auths = await Promise.all([
      makeActiveAuthority(user.id, `a${Date.now()}`),
      makeActiveAuthority(user.id, `b${Date.now()}`),
      makeActiveAuthority(user.id, `c${Date.now()}`),
    ]);
    const codes = auths.map((a) => a.code);

    const result = await revokeAllAuthorities(user.id);
    expect(result.revoked.sort()).toEqual([...codes].sort());
    expect(result.failed).toEqual([]);

    const all = await listAuthorities(user.id);
    expect(all.every((a) => a.status === "REVOKED")).toBe(true);
  });

  it("publishes a revocation under each Mandate jti, not the human ZK code", async () => {
    // Institutions verify the JWT jti / status-list bit — publishing under
    // the ZK-… code left every machine token valid after a consumer revoke.
    const user = await makeUser("publish");
    const auths = await Promise.all([
      makeActiveAuthority(user.id, `x${Date.now()}`),
      makeActiveAuthority(user.id, `y${Date.now()}`),
    ]);
    await revokeAllAuthorities(user.id);

    for (const auth of auths) {
      const byJti = await prisma.mandateRevocation.findUnique({
        where: { jti: auth.mandateJti },
      });
      expect(byJti).not.toBeNull();
      expect(byJti?.statusIndex).not.toBeNull();
      const byCode = await prisma.mandateRevocation.findUnique({ where: { jti: auth.code } });
      expect(byCode).toBeNull();
    }
  });

  it("does nothing destructive when there is nothing active to revoke", async () => {
    const user = await makeUser("empty");
    const result = await revokeAllAuthorities(user.id);
    expect(result).toEqual({ revoked: [], failed: [] });
  });

  it("leaves an already-revoked authority alone rather than erroring", async () => {
    const user = await makeUser("mixed");
    const auth = await makeActiveAuthority(user.id, `already${Date.now()}`);
    await revokeAuthority(user.id, auth.code);

    const result = await revokeAllAuthorities(user.id);
    // Nothing was active, so there was nothing for the bulk call to touch —
    // and touching an already-revoked one must never surface as a failure.
    expect(result.revoked).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("never touches another user's authority", async () => {
    const mine = await makeUser("mine");
    const theirs = await makeUser("theirs");
    const theirAuth = await makeActiveAuthority(theirs.id, `theirs${Date.now()}`);

    await revokeAllAuthorities(mine.id);

    const untouched = await prisma.authorization.findUnique({ where: { code: theirAuth.code } });
    expect(untouched?.status).toBe("ACTIVE");
  });
});
