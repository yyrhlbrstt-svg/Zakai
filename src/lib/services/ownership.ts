import "server-only";
import { prisma } from "@/lib/prisma";
import { generateNumericCode, hashCode, safeEqualHex } from "@/lib/codes";
import { sendSms, smsConfigured } from "@/lib/messaging";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s between sends

export type OwnershipSendResult =
  | { ok: true; devHint: boolean }
  | { ok: false; error: "cooldown" };

/**
 * Send a one-time ownership code to the user's registered phone. The code is
 * hashed at rest; the plaintext exists only in the SMS/Outbox. In dev (no SMS
 * provider) it lands in the Outbox so the flow is testable.
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

  return { ok: true, devHint: !smsConfigured() };
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
    where: { userId, consumedAt: null },
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
