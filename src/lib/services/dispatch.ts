import "server-only";
import { createAuthorization } from "./authorization";
import { sendOutreach, refreshVerifiedStatus, CaseError } from "./cases";
import { prisma } from "@/lib/prisma";

/**
 * Agent express path: after ownership is verified, issue Mandate + send to
 * the provider in one user gesture. Removes the two-click friction that
 * killed conversion between "I verified" and "actually sent".
 *
 * Hard gates unchanged: ownership required, never auto-charges a fee.
 */
export async function dispatchAgent(
  caseId: string,
  userId: string,
  counterpartyEmail?: string,
) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { authorization: true },
  });
  if (!kase || kase.userId !== userId) throw new CaseError("NOT_FOUND");
  if (!kase.ownershipVerifiedAt) throw new CaseError("OWNERSHIP_REQUIRED");

  const outreach =
    counterpartyEmail?.trim() && /@/.test(counterpartyEmail)
      ? counterpartyEmail.trim().toLowerCase()
      : undefined;
  if (outreach && outreach !== (kase.counterpartyEmail ?? "").toLowerCase()) {
    await prisma.case.update({
      where: { id: caseId },
      data: { counterpartyEmail: outreach },
    });
  }
  if (kase.status === "SENT" || kase.status === "SAVED" || kase.status === "NO_SAVING") {
    throw new CaseError("ALREADY_SENT");
  }

  // Issue human Authorization + optional Ed25519 Mandate if missing.
  let authCode: string | null = kase.authorization?.code ?? null;
  let mandateJti: string | undefined;
  if (!kase.authorization || kase.authorization.status !== "ACTIVE") {
    const auth = await createAuthorization(caseId);
    authCode = auth.code;
    mandateJti = auth.mandateJti;
  }

  await refreshVerifiedStatus(caseId);
  const email = await sendOutreach(caseId, userId);

  return {
    ok: true as const,
    authCode,
    mandateJti,
    status: "SENT" as const,
    delivered: email.status === "SENT",
  };
}
