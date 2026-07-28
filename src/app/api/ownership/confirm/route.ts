import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOwnershipMagic } from "@/lib/services/ownership";
import { refreshVerifiedStatus } from "@/lib/services/cases";
import { createAuthorization } from "@/lib/services/authorization";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(2000),
});

/**
 * Consume ownership magic-link JWT.
 * No session required — the token itself binds userId + caseId.
 * After success: auto-issue Mandate so dashboard shows one-tap dispatch.
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
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  let authCode: string | null = null;
  try {
    const existing = await prisma.authorization.findUnique({ where: { caseId: result.caseId } });
    if (!existing || existing.status !== "ACTIVE") {
      const created = await createAuthorization(result.caseId);
      authCode = created.code;
    } else {
      authCode = existing.code;
    }
  } catch {
    /* non-fatal */
  }

  await refreshVerifiedStatus(result.caseId).catch(() => null);

  return NextResponse.json({ ok: true, caseId: result.caseId, authCode });
}
