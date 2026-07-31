import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/codes";
import {
  VERIFICATION_TTL_HOURS,
  isEmailVerified,
  sendVerificationEmail,
  verifyEmailToken,
} from "./emailVerification";

/**
 * Written as the attacks rather than the happy path, because the thing this
 * protects is an administrative dashboard listing every lead's contact details.
 * Requires a live database; skipped without DATABASE_URL, like the other
 * integration suites here.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

async function makeUser(tag: string) {
  return prisma.user.create({
    data: {
      email: `verify-${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "Verify Tester",
      phone: "+972500000000",
      passwordHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashno",
      referralCode: `rc_${Math.random().toString(36).slice(2, 10)}`,
    },
    select: { id: true, email: true },
  });
}

suite("email verification", () => {
  it("issues a link and marks the address proven when it is used", async () => {
    const user = await makeUser("happy");
    const { sent, devToken } = await sendVerificationEmail(user.id, "https://zakai.test");
    expect(sent).toBe(true);
    expect(await isEmailVerified(user.id)).toBe(false);

    expect(await verifyEmailToken(devToken!)).toBe("ok");
    expect(await isEmailVerified(user.id)).toBe(true);
  });

  it("never stores the token itself", async () => {
    // A leaked database must not hand an attacker a working link for every
    // account in it.
    const user = await makeUser("hash");
    const { devToken } = await sendVerificationEmail(user.id, "https://zakai.test");
    const row = await prisma.emailVerification.findFirst({
      where: { userId: user.id },
      select: { tokenHash: true },
    });
    expect(row!.tokenHash).toBe(hashCode(devToken!));
    expect(row!.tokenHash).not.toBe(devToken);
  });

  it("refuses a token that was already used", async () => {
    const user = await makeUser("replay");
    const { devToken } = await sendVerificationEmail(user.id, "https://zakai.test");
    expect(await verifyEmailToken(devToken!)).toBe("ok");
    // Second use of the same link — a forwarded mailbox, a backup, a breach.
    expect(await verifyEmailToken(devToken!)).toBe("used");
  });

  it("refuses an expired token", async () => {
    const user = await makeUser("expired");
    const { devToken } = await sendVerificationEmail(user.id, "https://zakai.test");
    await prisma.emailVerification.updateMany({
      where: { tokenHash: hashCode(devToken!) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyEmailToken(devToken!)).toBe("expired");
    expect(await isEmailVerified(user.id)).toBe(false);
  });

  it("keeps invalid distinct from expired and used", async () => {
    // All three fail, and only one means "that link was never ours". The other
    // two have a different instruction: ask for another one.
    expect(await verifyEmailToken("not-a-real-token-at-all")).toBe("invalid");
  });

  it("kills every other outstanding token when one is consumed", async () => {
    // If an attacker triggered a link and the owner also requested one, the
    // owner completing theirs must not leave the attacker's alive.
    const user = await makeUser("multi");
    const first = await sendVerificationEmail(user.id, "https://zakai.test");
    const second = await sendVerificationEmail(user.id, "https://zakai.test");

    expect(await verifyEmailToken(second.devToken!)).toBe("ok");
    expect(await verifyEmailToken(first.devToken!)).toBe("used");
  });

  it("does not re-issue for an address already proven", async () => {
    // A link that does nothing teaches people our mail is noise.
    const user = await makeUser("already");
    const { devToken } = await sendVerificationEmail(user.id, "https://zakai.test");
    await verifyEmailToken(devToken!);

    const again = await sendVerificationEmail(user.id, "https://zakai.test");
    expect(again.sent).toBe(false);
  });

  it("reports an unknown user without throwing", async () => {
    expect((await sendVerificationEmail("usr_does_not_exist", "https://zakai.test")).sent).toBe(false);
  });

  it("gives the link a life measured in hours, not minutes", async () => {
    // Long enough to survive a mailbox somebody opens the next morning; short
    // enough that a forwarded message is stale.
    const user = await makeUser("ttl");
    await sendVerificationEmail(user.id, "https://zakai.test");
    const row = await prisma.emailVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true, createdAt: true },
    });
    const hours = (row!.expiresAt.getTime() - row!.createdAt.getTime()) / 3_600_000;
    expect(Math.round(hours)).toBe(VERIFICATION_TTL_HOURS);
  });

  it("points the link at the host the person is actually on", async () => {
    // A preview deployment must not mail out links to production.
    const user = await makeUser("origin");
    const { devToken } = await sendVerificationEmail(user.id, "https://preview.zakai.test", "en");
    const mail = await prisma.outbox.findFirst({
      where: { toAddress: user.email },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    expect(mail!.body).toContain("https://preview.zakai.test/en/verify-email?token=");
    expect(mail!.body).toContain(encodeURIComponent(devToken!));
  });
});
