import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { prisma } from "@/lib/prisma";
import { createCase, recordSaving, CaseError } from "./cases";
import { createAuthorization } from "./authorization";
import { PLANS } from "@/lib/plans";

/**
 * Needs a real database. Skipped — not failed — when DATABASE_URL is absent.
 *
 * A suite that goes red on a clean checkout tells you nothing about the change
 * you just made, and trains everyone to ignore red. An unrunnable test is
 * missing coverage, which is honest; a failing one is a false alarm, which is
 * worse than no alarm at all.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;


/**
 * Plan enforcement against the real database:
 *  1. FREE allows exactly one active case; the second throws CASE_LIMIT.
 *  2. MAX records a documented saving as SAVED with a zero, WAIVED fee.
 *  3. PRO charges half the FREE rate.
 */

/**
 * A chargeable fee must be bound to a signed Mandate, so the suite needs a
 * signing key. Generated per run and never persisted: the point of the
 * production rule is that keys come from env and are not minted at runtime,
 * and a test that quietly relied on a real one would be testing the
 * deployment rather than the code.
 */
beforeAll(async () => {
  if (!hasDb || process.env.MANDATE_SIGNING_JWK) return;
  const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
  process.env.MANDATE_SIGNING_JWK = JSON.stringify(await exportJWK(privateKey));
  process.env.MANDATE_SIGNING_KID = "plans-integration-test";
});

const tag = `plan-test-${Date.now()}`;
const userIds: string[] = [];

async function makeUser(plan: "FREE" | "PRO" | "MAX") {
  const user = await prisma.user.create({
    data: {
      email: `${tag}-${plan}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "בדיקת מסלול",
      phone: "+972500000020",
      passwordHash: "x",
      plan,
    },
  });
  userIds.push(user.id);
  return user;
}

/**
 * Bind a real Mandate before settling.
 *
 * `recordSaving` refuses to raise a fee without an ACTIVE authorization —
 * added on 2026-08-04, a week after this file was last touched, which left
 * these suites red for anyone who ran them with a database. They stayed green
 * in CI only because CI sets no DATABASE_URL. Creating the authorization here
 * is not a workaround: it is what production actually does before a case can
 * be settled, so the test now exercises the real path instead of one that no
 * longer exists.
 */
async function sendable(caseId: string) {
  await prisma.case.update({ where: { id: caseId }, data: { status: "SENT" } });
  await createAuthorization(caseId);
}

const caseInput = (userId: string) => ({
  userId,
  provider: "cellcom",
  amountShekels: 100,
  plan: "",
  strategy: "",
  targetShekels: 50,
  draftMessage: "בקשה",
});

afterAll(async () => {
  await prisma.case.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

suite("plan enforcement (integration)", () => {
  it("FREE: one active case only", async () => {
    const user = await makeUser("FREE");
    await createCase(caseInput(user.id));
    await expect(createCase(caseInput(user.id))).rejects.toThrow("CASE_LIMIT");
  });

  it("MAX: saving documented, case SAVED, fee zero and WAIVED", async () => {
    const user = await makeUser("MAX");
    const kase = await createCase(caseInput(user.id));
    await sendable(kase.id);

    const res = await recordSaving(kase.id, user.id, 50);
    expect(res.case.status).toBe("SAVED"); // saving counts even with 0% fee
    expect(res.feeNet).toBe(0);

    const fee = await prisma.fee.findUnique({ where: { caseId: kase.id } });
    expect(fee!.amount).toBe(0);
    expect(fee!.rateBps).toBe(0);
    expect(fee!.status).toBe("WAIVED");
  });

  it("PRO: charges half the FREE rate", async () => {
    const user = await makeUser("PRO");
    const kase = await createCase(caseInput(user.id));
    await sendable(kase.id);

    // ₪100 → ₪50: saving 5000 agorot; PRO 9% → 450 agorot (FREE would be 900).
    const res = await recordSaving(kase.id, user.id, 50);
    expect(res.feeNet).toBe(450);

    const fee = await prisma.fee.findUnique({ where: { caseId: kase.id } });
    expect(fee!.rateBps).toBe(PLANS.PRO.feeRateBps);
    expect(fee!.status).toBe("PENDING");
  });
});
