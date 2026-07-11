import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendOwnershipCode, verifyOwnershipCode } from "./ownership";

/**
 * Integration test for the ownership-verification mechanism against the real
 * database. In dev mode the SMS lands in the Outbox, so we can read the
 * plaintext code back and exercise the full send -> verify path, plus the
 * attempt cap and expiry rules.
 */

const phone = "+972500000001";
let userId: string;

async function readLatestCode(): Promise<string> {
  const sms = await prisma.outbox.findFirst({
    where: { channel: "SMS", toAddress: phone },
    orderBy: { createdAt: "desc" },
  });
  const match = sms?.body.match(/(\d{6})/);
  if (!match) throw new Error("no code in outbox");
  return match[1];
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `owner-test-${Date.now()}@zakai.test`,
      name: "בדיקה",
      phone,
      passwordHash: "x",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { toAddress: phone } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("ownership verification (integration)", () => {
  it("rejects a wrong code, then accepts the real one", async () => {
    const sent = await sendOwnershipCode(userId, phone);
    expect(sent.ok).toBe(true);

    const wrong = await verifyOwnershipCode(userId, "000000");
    // 000000 is astronomically unlikely to match; treat a match as invalid guard
    expect(wrong.ok).toBe(false);

    const code = await readLatestCode();
    const good = await verifyOwnershipCode(userId, code);
    expect(good.ok).toBe(true);

    // The code is single-use: verifying again finds no active code.
    const again = await verifyOwnershipCode(userId, code);
    expect(again).toEqual({ ok: false, error: "no_code" });
  });

  it("enforces the attempt cap", async () => {
    await prisma.phoneVerification.deleteMany({ where: { userId } });
    await sendOwnershipCode(userId, phone);
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await verifyOwnershipCode(userId, "999999"));
    }
    // After 5 failed attempts the 6th is locked out.
    expect(results[5]).toEqual({ ok: false, error: "too_many_attempts" });
  });

  it("rejects an expired code", async () => {
    await prisma.phoneVerification.deleteMany({ where: { userId } });
    await prisma.outbox.deleteMany({ where: { toAddress: phone } });
    await sendOwnershipCode(userId, phone);
    const record = await prisma.phoneVerification.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await prisma.phoneVerification.update({
      where: { id: record!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const code = await readLatestCode();
    const res = await verifyOwnershipCode(userId, code);
    expect(res).toEqual({ ok: false, error: "expired" });
  });
});
