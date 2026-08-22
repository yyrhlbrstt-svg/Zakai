import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { dispatchAgent } from "@/lib/services/dispatch";
import { CaseError } from "@/lib/services/cases";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { logSecurityEvent } from "@/lib/security/securityEvent";

const schema = z.object({
  counterpartyEmail: z.string().max(120).optional(),
});

/**
 * POST /api/cases/:id/dispatch
 * One-tap: Mandate (if needed) + send outreach to provider.
 * Requires ownership already verified.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const limited = await rateLimit("case-dispatch", auth.userId, 30, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await _request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});

  try {
    const result = await dispatchAgent(
      id,
      auth.userId,
      parsed.success ? parsed.data.counterpartyEmail : undefined,
    );
    // The one action in this product that cannot be taken back: a demand has
    // left, addressed to a company, in this person's name. Everything else can
    // be re-run. Recorded after it succeeded, so the row means it happened.
    await logSecurityEvent({
      type: "case_dispatched",
      userId: auth.userId,
      ip: clientIp(_request),
      detail: `case=${id} delivered=${result.delivered}`,
    });
    if (result.mandateJti) {
      await logSecurityEvent({
        type: "mandate_issued",
        userId: auth.userId,
        ip: clientIp(_request),
        detail: `case=${id} jti=${result.mandateJti}`,
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CaseError) {
      const status =
        err.message === "NOT_FOUND"
          ? 404
          : err.message === "OWNERSHIP_REQUIRED" || err.message === "AUTHORIZATION_REQUIRED"
            ? 409
            : err.message === "ALREADY_SENT"
              ? 409
              : err.message === "OUTREACH_DELIVERY_FAILED"
                ? 502
                : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
