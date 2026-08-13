import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeAuthorizationCode } from "@/lib/services/agentAuthorization";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trade the one-time code for the signed mandate, server to server.
 *
 * The mandate never travels through the person's browser. What came back on
 * the redirect was a code that is useless to anybody but the agent that asked,
 * and useless to it twice.
 */
const schema = z.object({
  agent: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const limited = await rateLimit("agent-token", clientIp(request), 60, 3600);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const result = await exchangeAuthorizationCode(parsed.data.agent, parsed.data.code);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });

  return NextResponse.json({
    mandate: result.mandateJws,
    token_type: "zakai-mandate+jws",
    expires_in: result.expiresIn,
  });
}
