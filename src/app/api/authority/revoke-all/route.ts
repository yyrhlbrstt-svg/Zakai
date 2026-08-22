import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/api";
import { revokeAllAuthorities } from "@/lib/services/authorityControl";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { logSecurityEvent } from "@/lib/security/securityEvent";

export const dynamic = "force-dynamic";

/**
 * Withdraw every authority this person holds, in one action. See
 * revokeAllAuthorities() for why this exists as its own function rather than
 * the client looping over individual revoke calls: this way one person's
 * emergency is one request, not N, and the server — not a page that might
 * get closed mid-loop — is what guarantees every authority gets attempted.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  // Tighter than the per-code revoke limit: this is a rare, high-impact
  // action, and a low ceiling costs a genuine user nothing while making the
  // endpoint a poor target for automated abuse.
  const limited = await rateLimit("authority_revoke_all", clientIp(request), 10, 600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  try {
    const result = await revokeAllAuthorities(auth.userId);
    await logSecurityEvent({
      type: "mandate_revoked",
      userId: auth.userId,
      ip: clientIp(request),
      detail: `all revoked=${JSON.stringify(result).slice(0, 120)}`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await reportError(err, { route: "authority/revoke-all" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
