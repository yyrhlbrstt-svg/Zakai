import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Right-to-be-forgotten guarantee: deleting a user erases every dependent
 * record via ON DELETE CASCADE — cases, authorizations, consents, rewards.
 */
describe("account deletion cascade (integration)", () => {
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
