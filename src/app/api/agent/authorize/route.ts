import { NextResponse } from "next/server";
import { z } from "zod";
import { startAuthorizationRequest } from "@/lib/services/agentAuthorization";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * An agent asks a person for authority.
 *
 * Returns a URL for the PERSON, and nothing else. No token, no session, no
 * hint about whether the person exists or has an account — this endpoint is
 * open to any registered agent and must not become a way to probe for people.
 *
 * The grant does not exist yet and will not exist unless a human opens that
 * URL and says yes.
 */
const schema = z.object({
  agent: z.string().trim().min(1).max(80),
  scopes: z.array(z.string().trim().min(1).max(60)).min(1).max(16),
  purpose: z.string().trim().min(1).max(400),
  redirect_uri: z.string().trim().min(1).max(500),
  state: z.string().max(200).optional(),
  grant_seconds: z.number().int().optional(),
});

export async function POST(request: Request) {
  const limited = await rateLimit("agent-authorize", clientIp(request), 60, 3600);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const result = await startAuthorizationRequest(SITE_URL, {
    agentSlug: parsed.data.agent,
    scopes: parsed.data.scopes,
    purpose: parsed.data.purpose,
    redirectUri: parsed.data.redirect_uri,
    state: parsed.data.state,
    grantSeconds: parsed.data.grant_seconds,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });

  return NextResponse.json({
    request_id: result.requestId,
    authorize_url: result.authorizeUrl,
    expires_at: result.expiresAt.toISOString(),
  });
}
