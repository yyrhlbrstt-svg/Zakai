import { NextResponse } from "next/server";
import { verifyOwnershipMagic } from "@/lib/services/ownership";
import { refreshVerifiedStatus } from "@/lib/services/cases";
import { createAuthorization } from "@/lib/services/authorization";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/magic?token=...
 * Consumes a magic-link token, marks ownership verified, and issues Mandate
 * when missing (same as POST /ownership/confirm) so the user can land on
 * dashboard and dispatch without a second click wall.
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
    if (result.error === "already") {
      const existing = await prisma.authorization.findUnique({
        where: { caseId: result.caseId },
      });
      let authCode: string | undefined = existing?.code;
      if (!existing) {
        try {
          const created = await createAuthorization(result.caseId);
          authCode = created.code;
        } catch {
          /* non-fatal — dashboard can still re-issue */
        }
      }
      await refreshVerifiedStatus(result.caseId).catch(() => null);
      return NextResponse.json({
        ok: true,
        already: true,
        caseId: result.caseId,
        authCode,
      });
    }
    const status = result.error === "expired" ? 410 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  let authCode: string | undefined;
  try {
    const existing = await prisma.authorization.findUnique({ where: { caseId: result.caseId } });
    if (existing) {
      authCode = existing.code;
    } else {
      const created = await createAuthorization(result.caseId);
      authCode = created.code;
    }
  } catch {
    /* non-fatal */
  }

  await refreshVerifiedStatus(result.caseId);

  return NextResponse.json({ ok: true, caseId: result.caseId, authCode });
}
