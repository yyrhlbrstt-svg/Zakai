import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { dispatchAgent } from "@/lib/services/dispatch";
import { CaseError } from "@/lib/services/cases";
import { rateLimit } from "@/lib/ratelimit";

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

  try {
    const result = await dispatchAgent(id, auth.userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CaseError) {
      const status =
        err.message === "NOT_FOUND"
          ? 404
          : err.message === "OWNERSHIP_REQUIRED"
            ? 409
            : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
