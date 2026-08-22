import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * The closed set of things worth being able to prove happened.
 *
 * The first five are about the account. The rest are about *authority*, and
 * they are the ones this product cannot do without: Zakai writes to a person's
 * bank in that person's name. If they later say "I never authorised that", an
 * Authorization row and an Outbox row show that the system did it — not that a
 * human asked it to, from where, and when. That gap is the whole reason a
 * mandate needs an audit trail beside it rather than inside it.
 */
export type SecurityEventType =
  | "login_failed"
  | "login_success"
  | "password_reset_requested"
  | "password_reset_completed"
  | "admin_access"
  /** The moment the system accepted that this person is who they claim. */
  | "ownership_verified"
  /** A signed mandate was minted in somebody's name. */
  | "mandate_issued"
  /** Authority withdrawn — by the person, on purpose. */
  | "mandate_revoked"
  /** A real demand left for a real company, as them. The irreversible one. */
  | "case_dispatched"
  /** Everything we hold about an account was handed over. */
  | "account_exported"
  /** …and the request that ends the account. */
  | "account_deleted";

/**
 * Best-effort audit write. A failure to log a security event is never a
 * reason to fail the request it's observing — same fail-open shape as
 * report-error.ts.
 */
export async function logSecurityEvent(input: {
  type: SecurityEventType;
  userId?: string | null;
  ip: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        ip: input.ip,
        detail: input.detail ?? "",
      },
    });
  } catch {
    // Audit logging must never break the request it's observing.
  }
}
