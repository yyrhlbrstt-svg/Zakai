import { describe, it, expect, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { revokeAllAuthorities, revokeAuthority, listAuthorities } from "./authorityControl";
import { STATUS_LIST_CAPACITY } from "@/lib/mandate/statusIndex";

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
  /**
   * Unique status bit, inside the list. The previous expression produced
   * indexes around 786,000,000 against a STATUS_LIST_CAPACITY of 1,000,000,
   * so publishing threw StatusListCapacityError and the revocation was never
   * written — the suite was asserting against a bit the fixture had put out
   * of range, not against real behaviour.
   */
  const mandateStatusIndex =
    (Date.now() * 1000 + Math.floor(Math.random() * 1000)) % STATUS_LIST_CAPACITY;
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
      mandateStatusIndex,
    },
  });
  return { code, mandateJti, mandateStatusIndex };
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

  /**
   * If the status-list bit is never published, every institution verifying the
   * machine Mandate still sees it as valid while the person has been told they
   * revoked. That failure used to be discarded by a `catch` whose `if` body
   * was empty, so nothing was logged and nobody could have known.
   */
  it("reports — never silently swallows — a revocation it could not publish", async () => {
    const user = await makeUser("unpublishable");
    const auth = await makeActiveAuthority(user.id, `bad${Date.now()}`);
    // Put the bit outside the status list, the one condition that makes
    // publishing impossible rather than merely temporarily unavailable.
    await prisma.authorization.update({
      where: { code: auth.code },
      data: { mandateStatusIndex: STATUS_LIST_CAPACITY + 1 },
    });

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await revokeAuthority(user.id, auth.code);
      // The consumer-facing revoke still stands: withdrawing the human
      // authority must not depend on the status store.
      expect(result.ok).toBe(true);

      const logged = errors.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(logged).toContain("status_list_capacity");
      expect(logged).toContain(auth.mandateJti);
    } finally {
      errors.mockRestore();
    }

    // And the machine token is genuinely still unpublished — which is exactly
    // why the operator has to be told.
    expect(
      await prisma.mandateRevocation.findUnique({ where: { jti: auth.mandateJti } }),
    ).toBeNull();
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
