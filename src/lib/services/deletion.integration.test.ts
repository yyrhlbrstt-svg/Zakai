import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

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
 * Right-to-be-forgotten guarantee: deleting a user erases every dependent
 * record via ON DELETE CASCADE — cases, authorizations, consents, rewards.
 */
suite("account deletion cascade (integration)", () => {
  it("erases cases, authorization, consent and rewards with the user", async () => {
    const tag = `del-test-${Date.now()}`;
    const user = await prisma.user.create({
      data: {
        email: `${tag}@zakai.test`,
        name: "למחיקה",
        phone: "+972500000030",
        passwordHash: "x",
        consents: { create: { purpose: "terms_privacy_v1" } },
      },
    });
    const kase = await prisma.case.create({
      data: { userId: user.id, provider: "cellcom", amountOriginal: 10000, targetAmount: 8000 },
    });
    await prisma.authorization.create({
      data: {
        caseId: kase.id,
        code: `ZK-${tag.slice(-4).toUpperCase()}-TEST`,
        principalName: "למחיקה",
        principalPhone: "+972500000030",
        principalEmail: `${tag}@zakai.test`,
        provider: "cellcom",
        scope: "בדיקה",
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.case.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.consent.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.authorization.count({ where: { caseId: kase.id } })).toBe(0);
    await prisma.$disconnect();
  });
});
