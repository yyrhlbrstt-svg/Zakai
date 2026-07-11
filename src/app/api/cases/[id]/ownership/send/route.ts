import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendOwnershipCode } from "@/lib/services/ownership";
import { maskPhone } from "@/lib/phone";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const kase = await prisma.case.findUnique({ where: { id }, include: { user: true } });
  if (!kase || kase.userId !== auth.userId) return badRequest("NOT_FOUND", 404);

  const result = await sendOwnershipCode(auth.userId, kase.user.phone, id);
  if (!result.ok) return badRequest("cooldown", 429);

  return NextResponse.json({
    ok: true,
    devHint: result.devHint,
    phoneMasked: maskPhone(kase.user.phone),
  });
}
