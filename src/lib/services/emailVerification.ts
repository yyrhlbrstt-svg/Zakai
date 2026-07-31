import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/codes";
import { sendEmail } from "@/lib/messaging";

/**
 * Proving somebody controls the address they registered with.
 *
 * THE HOLE THIS CLOSES
 *
 * Signup accepted any email and never checked it. That is fine for a mailing
 * list and not fine here, because two things in this product are keyed on an
 * address: account recovery, and `ADMIN_EMAIL` — which opens a dashboard
 * listing every lead's name, phone and company. Anyone who registered first
 * with the right address would have had it.
 *
 * WHY VERIFICATION IS NOT A WALL
 *
 * The obvious design is to block login until the address is confirmed, and it
 * is the wrong one for this product. A person arrives owed money, and putting a
 * mailbox round-trip between them and finding that out is the friction the
 * whole profile design exists to remove — most of what the app does needs no
 * account at all.
 *
 * So verification gates *privilege*, never basic use. You can sign up, look at
 * what you are owed and generate letters unverified. What you cannot do is hold
 * an administrative role, because that is the only place the distinction
 * between "typed an address" and "controls an address" actually costs somebody
 * something.
 *
 * FOUR PROPERTIES, THE SAME ONES ACCOUNT RECOVERY HAS
 *
 *  1. Only the hash of the token is stored. A leaked database must not hand an
 *     attacker a working verification link for every account in it.
 *  2. Single use, and short-lived. These links sit in mailboxes that get
 *     forwarded, backed up, and breached years later.
 *  3. Consuming one kills every other outstanding token for that user, so a
 *     link an attacker triggered does not survive the owner completing theirs.
 *  4. The outcome distinguishes expired and already-used from invalid. All
 *     three fail, and only one of them means "that link was never ours" — the
 *     other two mean "ask for a new one", which is a different instruction.
 */

/** Long enough that a forwarded link is stale, short enough to be usable. */
export const VERIFICATION_TTL_HOURS = 48;

function ttl(): Date {
  return new Date(Date.now() + VERIFICATION_TTL_HOURS * 3_600_000);
}

/**
 * 32 bytes from a CSPRNG, base64url — not the six-digit code used for phone
 * ownership. That one is protected by a per-record attempt counter and typed by
 * a human; a link is guessable at internet scale if it is short.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export type VerifyOutcome = "ok" | "invalid" | "expired" | "used" | "already_verified";

/**
 * Issue a verification link and mail it.
 *
 * `origin` is passed in by the caller rather than read from config, so the link
 * matches the host the person is actually on — a preview deployment must not
 * mail out links pointing at production.
 *
 * Returns the token only so tests and local development can assert on it. It is
 * never returned to a client.
 */
export async function sendVerificationEmail(
  userId: string,
  origin: string,
  locale = "he",
): Promise<{ sent: boolean; devToken?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!user) return { sent: false };
  // Already proven. Re-sending would be a link that does nothing, which teaches
  // people that our mail is noise.
  if (user.emailVerifiedAt) return { sent: false };

  const token = generateToken();
  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash: hashCode(token), expiresAt: ttl() },
  });

  const link = `${origin.replace(/\/$/, "")}/${locale}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "זכאי — אישור כתובת האימייל",
    body: [
      `שלום ${user.name},`,
      "",
      "כדי לאשר שכתובת האימייל הזאת שלך, פתח את הקישור:",
      link,
      "",
      `הקישור תקף ${VERIFICATION_TTL_HOURS} שעות וניתן לשימוש פעם אחת.`,
      "",
      "אם לא נרשמת לזכאי — אפשר להתעלם מההודעה. בלי לחיצה על הקישור לא נעשה דבר.",
      "",
      "—",
      "זכאי",
    ].join("\n"),
  });

  return { sent: true, devToken: token };
}

/**
 * Consume a token.
 *
 * Everything happens in one transaction: marking the user verified and killing
 * every outstanding token for them must not be separable, or a crash between
 * the two leaves live links for an account that is already verified.
 */
export async function verifyEmailToken(token: string): Promise<VerifyOutcome> {
  const tokenHash = hashCode(token);
  const record = await prisma.emailVerification.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });

  // Not ours. Deliberately distinct from expired and used: only this one means
  // the link was never valid, and the other two have a different instruction.
  if (!record) return "invalid";
  if (record.consumedAt) return "used";
  if (record.expiresAt.getTime() <= Date.now()) return "expired";

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { emailVerifiedAt: true },
  });
  if (user?.emailVerifiedAt) return "already_verified";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    // Every other outstanding token dies with it, so a link an attacker
    // triggered does not survive the owner completing theirs.
    prisma.emailVerification.updateMany({
      where: { userId: record.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  return "ok";
}

/**
 * Has this person proved they control their address?
 *
 * The one question every privileged path should ask, in one place, so a future
 * privileged path cannot forget to.
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  return Boolean(user?.emailVerifiedAt);
}
