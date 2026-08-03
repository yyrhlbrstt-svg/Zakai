import "server-only";
import { stampOwnershipFromVerifiedEmail } from "@/lib/services/ownership";
import { createAuthorization } from "@/lib/services/authorization";
import { refreshVerifiedStatus } from "@/lib/services/cases";

/**
 * Collapse APPROVED → VERIFIED for accounts that already proved email control.
 * Called after consent (approve / autoApprove open) so the next tap can dispatch.
 */
export async function primeCaseForFastSend(
  userId: string,
  caseId: string,
): Promise<{ ownershipViaEmail: boolean }> {
  const ownershipViaEmail = await stampOwnershipFromVerifiedEmail(userId, caseId);
  if (ownershipViaEmail) {
    try {
      await createAuthorization(caseId);
    } catch {
      /* may already exist */
    }
  }
  await refreshVerifiedStatus(caseId);
  return { ownershipViaEmail };
}
