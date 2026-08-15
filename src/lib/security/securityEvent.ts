import "server-only";
import { prisma } from "@/lib/prisma";

export type SecurityEventType =
  | "login_failed"
  | "login_success"
  | "password_reset_requested"
  | "password_reset_completed"
  | "admin_access";

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
