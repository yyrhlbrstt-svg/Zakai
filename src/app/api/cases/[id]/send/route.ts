import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { sendOutreach, CaseError } from "@/lib/services/cases";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  try {
    const email = await sendOutreach(id, auth.userId);
    // The Outbox row this actually created — "SENT" only when a real
    // transport (SMTP_HOST) delivered it. Without one it stays "QUEUED",
    // and the caller needs to know that, not just that the API call
    // succeeded: a case is claimed SENT the moment this route returns ok,
    // so a screen that always says "delivered" would be true about the
    // app's internal state and false about whether the provider ever saw it.
    return NextResponse.json({ ok: true, delivered: email.status === "SENT" });
  } catch (err) {
    if (err instanceof CaseError) {
      const status =
        err.message === "NOT_FOUND"
          ? 404
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
