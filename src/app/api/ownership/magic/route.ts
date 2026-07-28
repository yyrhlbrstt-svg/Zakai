import { NextResponse } from "next/server";
import { verifyOwnershipMagic } from "@/lib/services/ownership";
import { refreshVerifiedStatus } from "@/lib/services/cases";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/magic?token=...
 * Consumes a magic-link token and marks the case ownership-verified.
 * Idempotent for already-verified cases.
 */
export async function GET(request: Request) {
  const limited = await rateLimit("ownership-magic", clientIp(request), 30, 3600);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token || token.length < 20) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const result = await verifyOwnershipMagic(token);
  if (!result.ok) {
    const status = result.error === "expired" ? 410 : result.error === "already" ? 200 : 400;
    return NextResponse.json(
      {
        ok: result.error === "already",
        error: result.error === "already" ? undefined : result.error,
        already: result.error === "already",
      },
      { status },
    );
  }

  await refreshVerifiedStatus(result.caseId);

  return NextResponse.json({ ok: true, caseId: result.caseId });
}
