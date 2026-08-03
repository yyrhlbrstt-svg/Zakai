import "server-only";

import { dispatchAgent } from "@/lib/services/dispatch";

/**
 * After createCase(+autoApprove): same gesture → Mandate SENT when the
 * account already proved email control and ownership was primed.
 * Fail-open: never block case creation if dispatch cannot complete.
 */
export async function tryExpressMandateSend(
  caseId: string,
  userId: string,
  emailVerifiedAt: Date | string | null | undefined,
): Promise<{ dispatched: boolean; delivered: boolean }> {
  if (!emailVerifiedAt) return { dispatched: false, delivered: false };
  try {
    const d = await dispatchAgent(caseId, userId);
    return { dispatched: true, delivered: d.delivered };
  } catch {
    return { dispatched: false, delivered: false };
  }
}

/** JSON body fragment for vertical open responses. */
export function expressOpenBody<T extends Record<string, unknown> = Record<string, never>>(input: {
  caseId: string;
  dispatched: boolean;
  delivered: boolean;
  extra?: T;
}): {
  caseId: string;
  message: "mandate_sent" | "case_opened";
  dispatched: boolean;
  delivered: boolean;
  needsOutreachEmail: false;
} & T {
  return {
    caseId: input.caseId,
    message: input.dispatched ? ("mandate_sent" as const) : ("case_opened" as const),
    dispatched: input.dispatched,
    delivered: input.delivered,
    needsOutreachEmail: false,
    ...(input.extra ?? ({} as T)),
  };
}
