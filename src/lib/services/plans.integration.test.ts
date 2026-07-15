import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCase, recordSaving, CaseError } from "./cases";
import { PLANS } from "@/lib/plans";

/**
 * Plan enforcement against the real database:
 *  1. FREE allows exactly one active case; the second throws CASE_LIMIT.
 *  2. MAX records a documented saving as SAVED with a zero, WAIVED fee.
 *  3. PRO charges half the FREE rate.
 */

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

describe("plan enforcement (integration)", () => {
  it("FREE: one active case only", async () => {
    const user = await makeUser("FREE");
    await createCase(caseInput(user.id));
    await expect(createCase(caseInput(user.id))).rejects.toThrow("CASE_LIMIT");
  });

  it("MAX: saving documented, case SAVED, fee zero and WAIVED", async () => {
    const user = await makeUser("MAX");
    const kase = await createCase(caseInput(user.id));
    await prisma.case.update({ where: { id: kase.id }, data: { status: "SENT" } });

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
    await prisma.case.update({ where: { id: kase.id }, data: { status: "SENT" } });

    // ₪100 → ₪50: saving 5000 agorot; PRO 9% → 450 agorot (FREE would be 900).
    const res = await recordSaving(kase.id, user.id, 50);
    expect(res.feeNet).toBe(450);

    const fee = await prisma.fee.findUnique({ where: { caseId: kase.id } });
    expect(fee!.rateBps).toBe(PLANS.PRO.feeRateBps);
    expect(fee!.status).toBe("PENDING");
  });
});
