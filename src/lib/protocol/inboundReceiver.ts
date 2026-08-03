/**
 * Pure validation for institution inbound receive — cloneable logic.
 * Used by POST /api/institution/inbound-receive (reference) and documented
 * under reference/inbound-receiver/.
 */

import { z } from "zod";

export const inboundReceiveBodySchema = z.object({
  mandate_jws: z.string().min(20).max(16_384),
  mandate_jti: z.string().min(8).max(128),
  authorization_code: z.string().max(40).optional(),
  subject_hint: z.string().max(120).optional(),
  intent: z.enum(["cancel", "retention", "switch", "dispute", "information_request"]),
  vertical: z.string().min(1).max(40),
  locale: z.string().max(20).optional(),
  switching_profile_id: z.string().max(80).optional(),
});

export type InboundReceiveBody = z.infer<typeof inboundReceiveBodySchema>;

const processed = new Map<string, number>();

/** True if this jti already completed a successful accept in-process. */
export function inboundJtiSeen(jti: string): boolean {
  return processed.has(jti);
}

/**
 * Record a successful accept. Call only after accept — never on 503/401 —
 * or a transient revocation-store failure would poison retries as duplicates.
 */
export function rememberInboundJti(jti: string): "new" | "duplicate" {
  if (processed.has(jti)) return "duplicate";
  processed.set(jti, Date.now());
  // Cap memory in long-lived processes
  if (processed.size > 10_000) {
    const oldest = [...processed.entries()].sort((a, b) => a[1] - b[1]).slice(0, 1000);
    for (const [k] of oldest) processed.delete(k);
  }
  return "new";
}

export function resetInboundIdempotencyForTests() {
  processed.clear();
}
