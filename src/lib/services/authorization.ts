import "server-only";
import { prisma } from "@/lib/prisma";
import { generateAuthorizationCode } from "@/lib/codes";
import { maskPhone } from "@/lib/phone";

/** Scope text stored on the authorization (the mandate the provider can read). */
const SCOPE =
  "בדיקת החיוב החודשי מול הספק והפחתתו או התאמת המסלול, וניהול ההתכתבות הדרושה לכך בלבד. אינו כולל עסקאות חדשות, שינוי אמצעי תשלום, או מסירת מידע רגיש מעבר לנדרש לזיהוי.";

/**
 * Generate the power-of-attorney-style authorization document for a case.
 * Idempotent: if one already exists for the case, it is returned as-is.
 * The `code` is unique and human-verifiable; a provider checks it on the public
 * /verify page.
 */
export async function createAuthorization(caseId: string) {
  const existing = await prisma.authorization.findUnique({ where: { caseId } });
  if (existing) return existing;

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { user: true },
  });
  if (!kase) throw new Error("case not found");

  // Retry a few times in the (astronomically unlikely) event of a code clash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAuthorizationCode();
    const clash = await prisma.authorization.findUnique({ where: { code } });
    if (clash) continue;
    return prisma.authorization.create({
      data: {
        caseId,
        code,
        principalName: kase.user.name,
        principalPhone: kase.user.phone,
        principalEmail: kase.user.email,
        provider: kase.provider,
        scope: SCOPE,
      },
    });
  }
  throw new Error("could not allocate a unique authorization code");
}

export async function revokeAuthorization(caseId: string) {
  return prisma.authorization.update({
    where: { caseId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
}

/** Public lookup for the provider-facing verification page. Masks PII. */
export async function getPublicAuthorization(code: string) {
  const auth = await prisma.authorization.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!auth) return null;
  return {
    code: auth.code,
    status: auth.status,
    principalName: auth.principalName,
    principalPhoneMasked: maskPhone(auth.principalPhone),
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    revokedAt: auth.revokedAt,
  };
}
