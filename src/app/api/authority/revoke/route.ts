import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/api";
import { revokeAuthority } from "@/lib/services/authorityControl";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { logSecurityEvent } from "@/lib/security/securityEvent";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().min(4).max(40) });

/**
 * Withdraw an authority.
 *
 * Session-authenticated and ownership-checked in the service, not here: the
 * public code appears on documents we send to third parties, so a route that
 * acted on a code alone would let anyone holding one cancel a stranger's
 * mandate.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("authority_revoke", clientIp(request), 60, 600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const result = await revokeAuthority(auth.userId, parsed.data.code);
    if (!result.ok) return NextResponse.json({ error: "notFound" }, { status: 404 });
    await logSecurityEvent({
      type: "mandate_revoked",
      userId: auth.userId,
      ip: clientIp(request),
      detail: `code=${parsed.data.code} alreadyRevoked=${result.alreadyRevoked}`,
    });
    return NextResponse.json({ ok: true, alreadyRevoked: result.alreadyRevoked });
  } catch (err) {
    await reportError(err, { route: "authority/revoke" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
