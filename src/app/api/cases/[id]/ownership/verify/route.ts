import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyOwnershipCode } from "@/lib/services/ownership";
import { refreshVerifiedStatus } from "@/lib/services/cases";
import { createAuthorization } from "@/lib/services/authorization";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({ code: z.string().trim().regex(/^\d{4,8}$/) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const limited = await rateLimit("otp-verify", clientIp(request), 30, 600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || kase.userId !== auth.userId) return badRequest("NOT_FOUND", 404);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("codeInvalid", 400);

  const result = await verifyOwnershipCode(auth.userId, parsed.data.code, id);
  if (!result.ok) {
    const map: Record<string, number> = {
      invalid: 400,
      expired: 400,
      too_many_attempts: 429,
      no_code: 400,
    };
    return badRequest(result.error, map[result.error] ?? 400);
  }

  // Eager Mandate so the next UI step is one-tap dispatch.
  let authCode: string | null = null;
  let mandateJti: string | undefined;
  try {
    const existing = await prisma.authorization.findUnique({ where: { caseId: id } });
    if (!existing || existing.status !== "ACTIVE") {
      const created = await createAuthorization(id);
      authCode = created.code;
      mandateJti = created.mandateJti;
    } else {
      authCode = existing.code;
    }
  } catch {
    /* dispatch will retry */
  }

  await refreshVerifiedStatus(id);
  return NextResponse.json({ ok: true, authCode, mandateJti });
}
