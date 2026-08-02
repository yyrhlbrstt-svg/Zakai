import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildAuthorityWalletBundle } from "@/lib/mandate/walletBundle";
import { parseLocaleParam } from "@/lib/localePath";

const schema = z.object({
  code: z.string().min(8).max(32),
  locale: z.string().max(8).optional(),
});

/**
 * Export a portable authority wallet bundle (JSON) the user can store offline.
 * Requires login + ownership of the authorization's case.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("invalid");

  const code = parsed.data.code.trim().toUpperCase();
  const row = await prisma.authorization.findFirst({
    where: { code, case: { userId: auth.userId } },
    select: {
      code: true,
      provider: true,
      scope: true,
      status: true,
      issuedAt: true,
      revokedAt: true,
      caseId: true,
    },
  });
  if (!row) return badRequest("not_found", 404);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { country: true },
  });

  const origin = new URL(request.url).origin;
  const locale = parseLocaleParam(parsed.data.locale);

  const bundle = buildAuthorityWalletBundle({
    origin,
    locale,
    country: user?.country ?? null,
    row: {
      ...row,
      status: row.status as "ACTIVE" | "REVOKED" | "EXPIRED",
    },
  });

  return NextResponse.json({ ok: true, bundle });
}
