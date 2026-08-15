import { NextResponse } from "next/server";
import { z } from "zod";
import { decideAuthorization } from "@/lib/services/agentAuthorization";
import { requireUserId } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The human's answer. The only path in this flow that requires a session, and
 * the only one that can cause a mandate to exist.
 */
const schema = z.object({
  request_id: z.string().trim().min(1).max(60),
  approve: z.boolean(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("agent-decide", auth.userId, 40, 3600);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const result = await decideAuthorization(parsed.data.request_id, auth.userId, parsed.data.approve);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ redirect_to: result.redirectTo });
}
