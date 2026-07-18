import { NextResponse } from "next/server";
import { getPublicAuthorization } from "@/lib/services/authorization";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Public authorization lookup for the provider-facing verify page. No auth by
 * design — a provider must be able to verify a mandate from the code alone.
 *
 * The code is high-entropy (ZK-XXXX-XXXX, 32^8 ≈ 1.1e12), and this endpoint is
 * IP rate-limited so the code space can't be enumerated to harvest names. Only
 * masked PII is ever returned (email is never exposed; phone is masked).
 */
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const limited = await rateLimit("authz-verify", clientIp(request), 40, 3600);
  if (limited) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { code } = await ctx.params;
  const auth = await getPublicAuthorization(code);
  if (!auth) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, authorization: auth });
}
