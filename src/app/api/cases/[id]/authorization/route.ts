import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createAuthorization } from "@/lib/services/authorization";
import { refreshVerifiedStatus } from "@/lib/services/cases";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || kase.userId !== auth.userId) return badRequest("NOT_FOUND", 404);

  const doc = await createAuthorization(id);
  await refreshVerifiedStatus(id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({
    ok: true,
    code: doc.code,
    scope: doc.scope,
    verifyUrl: `${appUrl}/verify?code=${doc.code}`,
    documentUrl: `/authorization/${doc.code}`,
  });
}
