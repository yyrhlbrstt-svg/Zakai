import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { generateNumericCode, hashCode, safeEqualHex } from "@/lib/codes";
import { sendSms, sendEmail, smsConfigured } from "@/lib/messaging";
import { absoluteLocaleUrl, localeForCountry } from "@/lib/localePath";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAGIC_TTL_SECONDS = 15 * 60; // 15 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s between sends

const DEV_ONLY_FALLBACK_SECRET =
  "zakai-insecure-development-only-secret-do-not-use-in-production";

function ownershipSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET required for ownership magic links");
  }
  return new TextEncoder().encode(DEV_ONLY_FALLBACK_SECRET);
}

export type OwnershipSendResult =
  | { ok: true; devHint: boolean; magicSent: boolean }
  | { ok: false; error: "cooldown" };

/**
 * Send a one-time ownership code to the user's registered phone AND a
 * magic link to their email. Doctrine: never leave a phone for a callback —
 * the OTP goes to the phone already on the account; the magic link is the
 * zero-SMS path for users who prefer email.
 */
export async function sendOwnershipCode(
  userId: string,
  phone: string,
  caseId?: string,
): Promise<OwnershipSendResult> {
  const recent = await prisma.phoneVerification.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "cooldown" };
  }

  const code = generateNumericCode(6);
  await prisma.phoneVerification.create({
    data: {
      userId,
      caseId,
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  await sendSms({
    to: phone,
    body: `זכאי: קוד האימות שלך הוא ${code}. בתוקף ל-10 דקות. לא שיתפת בקשה זו? אפשר להתעלם.`,
    caseId,
  });

  // Parallel path: magic link by email (no SMS dependency).
  let magicSent = false;
  if (caseId) {
    try {
      await sendOwnershipMagicLink(userId, caseId);
      magicSent = true;
    } catch {
      /* SMS path still works */
    }
  }

  return { ok: true, devHint: !smsConfigured(), magicSent };
}

/**
 * Issue a short-lived JWT magic link and email it to the account owner.
 * Clicking the link verifies ownership without typing an OTP.
 */
export async function sendOwnershipMagicLink(
  userId: string,
  caseId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, country: true },
  });
  if (!user?.email) return { ok: false, error: "no_email" };

  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.userId !== userId) return { ok: false, error: "not_found" };
  if (kase.ownershipVerifiedAt) return { ok: false, error: "already_verified" };

  const token = await new SignJWT({
    purpose: "ownership",
    userId,
    caseId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_TTL_SECONDS}s`)
    .sign(ownershipSecret());

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = absoluteLocaleUrl(
    appUrl,
    localeForCountry(user.country),
    `/ownership/confirm?token=${encodeURIComponent(token)}`,
  );

  await sendEmail({
    to: user.email,
    subject: "זכאי — אימות בעלות בלחיצה אחת",
    body: `שלום ${user.name},

כדי לאשר שהתיק מול הספק שייך לחשבון שלך, לחץ/י על הקישור (בתוקף ${MAGIC_TTL_SECONDS / 60} דקות):

${url}

אפשר גם להזין קוד SMS בדשבורד — אותה פעולה.

לא ביקשת את זה? אפשר להתעלם.

זכאי — סוכן כסף לצרכן.`,
    caseId,
  });

  return { ok: true, url };
}

export type MagicVerifyResult =
  | { ok: true; caseId: string }
  | { ok: false; error: "invalid" | "expired" | "already" | "not_found" };

/** Consume a magic-link token and stamp ownershipVerifiedAt. */
export async function verifyOwnershipMagic(token: string): Promise<MagicVerifyResult> {
  let payload: { purpose?: string; userId?: string; caseId?: string };
  try {
    const verified = await jwtVerify(token, ownershipSecret());
    payload = verified.payload as typeof payload;
  } catch {
    return { ok: false, error: "expired" };
  }

  if (payload.purpose !== "ownership" || !payload.userId || !payload.caseId) {
    return { ok: false, error: "invalid" };
  }

  const kase = await prisma.case.findUnique({ where: { id: payload.caseId } });
  if (!kase || kase.userId !== payload.userId) return { ok: false, error: "not_found" };
  if (kase.ownershipVerifiedAt) return { ok: false, error: "already" };

  await prisma.case.update({
    where: { id: payload.caseId },
    data: { ownershipVerifiedAt: new Date() },
  });

  // Consume any outstanding OTP so it cannot be replayed.
  await prisma.phoneVerification.updateMany({
    where: { userId: payload.userId, caseId: payload.caseId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  return { ok: true, caseId: payload.caseId };
}

export type OwnershipVerifyResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" | "no_code" };

/**
 * Verify a submitted code against the latest active verification for the user.
 * Enforces expiry and a per-code attempt cap. On success, stamps the case as
 * ownership-verified (if a caseId is given).
 */
export async function verifyOwnershipCode(
  userId: string,
  code: string,
  caseId?: string,
): Promise<OwnershipVerifyResult> {
  const record = await prisma.phoneVerification.findFirst({
    // A code minted for one case must not stamp a different case as verified:
    // the verification lands on whatever caseId the caller passes, so matching
    // "the user's latest code, whichever case it was for" would let the code
    // sent for case A verify case B. Codes issued without a case (generic
    // phone verification) stay usable for any of the user's cases.
    where: {
      userId,
      consumedAt: null,
      ...(caseId ? { OR: [{ caseId }, { caseId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "no_code" };

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" };
  }

  const matches = safeEqualHex(record.codeHash, hashCode(code));
  if (!matches) {
    await prisma.phoneVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    return { ok: false, error: remaining <= 0 ? "too_many_attempts" : "invalid" };
  }

  await prisma.phoneVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  if (caseId) {
    await prisma.case.update({
      where: { id: caseId },
      data: { ownershipVerifiedAt: new Date() },
    });
  }

  return { ok: true };
}
