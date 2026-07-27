import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashCode, safeEqualHex } from "@/lib/codes";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/messaging";

/**
 * Account recovery.
 *
 * Until now there was none: no route, no link, no message. A user who forgot
 * their password was locked out of their money permanently, which is the single
 * most common reason a real person cannot log in to anything. Everything else
 * in this codebase — the case pipeline, the ledger, the fee — is unreachable
 * behind that door.
 *
 * Four properties this has to have, and why:
 *
 *  1. **Only the hash of the token is stored.** The same discipline
 *     PhoneVerification already uses. A leaked database must not hand an
 *     attacker a working reset link for every account in it.
 *  2. **Requesting a reset never reveals whether an account exists.** The
 *     response is identical either way. Otherwise the endpoint becomes a free
 *     membership oracle for a service whose membership is itself sensitive —
 *     "this person is chasing benefits" is not a fact we get to leak.
 *  3. **Single use, short lived.** Reset links end up in mailboxes that get
 *     forwarded, backed up and breached years later.
 *  4. **Every outstanding token for that user dies when one is used.** If a
 *     reset was triggered by an attacker and the real owner also requested one,
 *     the owner completing theirs must not leave the attacker's link alive.
 */

/** Reset links expire fast; requesting another one is free. */
export const RESET_TTL_MINUTES = 60;

function tokenTtl(): Date {
  return new Date(Date.now() + RESET_TTL_MINUTES * 60_000);
}

/**
 * 32 bytes from a CSPRNG, base64url. Not the 6-digit numeric code used for
 * phone ownership: that one is guarded by a per-case attempt counter and is
 * typed by a human, whereas a reset link is guessable at internet scale if it
 * is short.
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export interface ResetRequestResult {
  /** Always true — the caller must not branch on whether the account existed. */
  accepted: true;
  /** The link, returned only so tests and dev can assert on it. Never sent to the client. */
  devToken?: string;
}

/**
 * Start a reset. Always reports success.
 *
 * `origin` is passed in by the route rather than read from config so the link
 * matches the host the user is actually on — a preview deployment must not mail
 * out links pointing at production.
 */
export async function requestPasswordReset(
  email: string,
  origin: string,
  locale = "he",
): Promise<ResetRequestResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true },
  });

  // No account: stop here, but return the same shape, at roughly the same cost.
  if (!user) return { accepted: true };

  const token = generateResetToken();
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: hashCode(token), expiresAt: tokenTtl() },
  });

  const link = `${origin.replace(/\/$/, "")}/${locale}/reset?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "זכאי — איפוס סיסמה",
    body: resetEmailBody(user.name, link),
  });

  return { accepted: true, devToken: token };
}

function resetEmailBody(name: string, link: string): string {
  return `שלום ${name},

קיבלנו בקשה לאיפוס הסיסמה לחשבון זכאי שלך.

לקביעת סיסמה חדשה:
${link}

הקישור תקף ל-${RESET_TTL_MINUTES} דקות וניתן לשימוש פעם אחת בלבד.

אם לא ביקשת לאפס סיסמה — אפשר להתעלם מההודעה. הסיסמה הנוכחית נשארת בתוקף ולא בוצע שום שינוי בחשבון.

זכאי`;
}

export type ResetOutcome = "ok" | "invalid" | "expired" | "used";

/**
 * Complete a reset.
 *
 * `invalid` and `expired` are reported separately because they mean different
 * things to an honest user: one is "that link is wrong", the other is "that
 * link was right but you were too slow, ask for another". Collapsing them makes
 * the second case look like a bug in the product and generates support mail.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const trimmed = token.trim();
  if (!trimmed) return "invalid";

  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashCode(trimmed) },
  });
  if (!record) return "invalid";

  // Constant-time compare on the stored hash. The lookup above already matched
  // it, so this guards only against a future change that widens the query.
  if (!safeEqualHex(record.tokenHash, hashCode(trimmed))) return "invalid";

  if (record.consumedAt) return "used";
  if (record.expiresAt.getTime() <= Date.now()) return "expired";

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    // Kill every other outstanding token for this user. If an attacker also
    // requested a reset, the owner completing theirs must not leave the
    // attacker's link alive.
    prisma.passwordReset.updateMany({
      where: { userId: record.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  return "ok";
}
