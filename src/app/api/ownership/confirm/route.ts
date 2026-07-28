import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOwnershipMagic } from "@/lib/services/ownership";
import { refreshVerifiedStatus } from "@/lib/services/cases";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(2000),
});

/**
 * Consume ownership magic-link JWT.
 * No session required — the token itself binds userId + caseId.
 * After success, advance case to VERIFIED if Mandate already exists.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("ownership-magic", clientIp(request), 20, 3600);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const result = await verifyOwnershipMagic(parsed.data.token);
  if (!result.ok) {
    const status =
      result.error === "expired" ? 410 : result.error === "already" ? 200 : 400;
    return NextResponse.json(
      { ok: false, error: result.error, caseId: result.error === "already" ? undefined : undefined },
      { status },
    );
  }

  // If authorization already exists, promote APPROVED → VERIFIED.
  await refreshVerifiedStatus(result.caseId).catch(() => null);

  return NextResponse.json({ ok: true, caseId: result.caseId });
}
