import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/codes";
import { verifyPassword } from "@/lib/auth/password";
import {
  RESET_TTL_MINUTES,
  completePasswordReset,
  requestPasswordReset,
} from "./passwordReset";

/**
 * Account recovery is a security surface, so the tests are written as the
 * attacks rather than as the happy path. Requires a live database; skipped
 * without DATABASE_URL, like the other integration suites here.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

let userId: string;
let email: string;

async function makeUser(tag: string) {
  const address = `reset-${tag}-${Math.random().toString(36).slice(2)}@zakai.test`;
  const user = await prisma.user.create({
    data: {
      email: address,
      name: "Reset Tester",
      phone: "+972500000000",
      passwordHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashno",
      referralCode: `rc_${Math.random().toString(36).slice(2, 10)}`,
    },
    select: { id: true, email: true },
  });
  return user;
}

suite("password reset", () => {
  beforeAll(async () => {
    const user = await makeUser("main");
    userId = user.id;
    email = user.email;
  });

  it("issues a token and lets the owner set a new password", async () => {
    const { devToken } = await requestPasswordReset(email, "https://zakai.test");
    expect(devToken).toBeTruthy();

    expect(await completePasswordReset(devToken!, "a-brand-new-password")).toBe("ok");

    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(await verifyPassword("a-brand-new-password", after!.passwordHash)).toBe(true);
  });

  it("stores only the hash of the token, never the token", async () => {
    const { devToken } = await requestPasswordReset(email, "https://zakai.test");
    const rows = await prisma.passwordReset.findMany({ where: { userId } });
    expect(rows.some((r) => r.tokenHash === devToken)).toBe(false);
    expect(rows.some((r) => r.tokenHash === hashCode(devToken!))).toBe(true);
  });

  it("accepts a reset for an address that does not exist, and reveals nothing", async () => {
    const result = await requestPasswordReset("nobody@zakai.test", "https://zakai.test");
    expect(result.accepted).toBe(true);
    expect(result.devToken).toBeUndefined();
  });

  it("refuses to reuse a token", async () => {
    const { devToken } = await requestPasswordReset(email, "https://zakai.test");
    expect(await completePasswordReset(devToken!, "first-password-here")).toBe("ok");
    expect(await completePasswordReset(devToken!, "second-password-here")).toBe("used");
  });

  it("refuses an expired token", async () => {
    const { devToken } = await requestPasswordReset(email, "https://zakai.test");
    await prisma.passwordReset.update({
      where: { tokenHash: hashCode(devToken!) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await completePasswordReset(devToken!, "too-late-password")).toBe("expired");
  });

  it("refuses a forged token", async () => {
    expect(await completePasswordReset("not-a-real-token-at-all", "whatever-pass")).toBe("invalid");
    expect(await completePasswordReset("", "whatever-pass")).toBe("invalid");
  });

  it("kills every other outstanding token when one is used", async () => {
    // An attacker requests a reset, then the real owner requests their own and
    // completes it. The attacker's link must be dead.
    const attacker = await requestPasswordReset(email, "https://zakai.test");
    const owner = await requestPasswordReset(email, "https://zakai.test");

    expect(await completePasswordReset(owner.devToken!, "owner-new-password")).toBe("ok");
    expect(await completePasswordReset(attacker.devToken!, "attacker-password")).toBe("used");
  });

  it("issues links that expire within the stated window", async () => {
    const before = Date.now();
    const { devToken } = await requestPasswordReset(email, "https://zakai.test");
    const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashCode(devToken!) } });
    const ttlMs = row!.expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(RESET_TTL_MINUTES * 60_000 + 5_000);
  });

  it("sends the link to the address on the account, on the host the user is using", async () => {
    const { devToken } = await requestPasswordReset(email, "https://preview.zakai.test/", "en");
    const mail = await prisma.outbox.findFirst({
      where: { toAddress: email },
      orderBy: { createdAt: "desc" },
    });
    expect(mail?.body).toContain("https://preview.zakai.test/en/reset?token=");
    expect(mail?.body).toContain(encodeURIComponent(devToken!));
  });
});
