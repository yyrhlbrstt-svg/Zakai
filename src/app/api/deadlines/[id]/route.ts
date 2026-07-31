import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const deadline = await prisma.deadline.findUnique({ where: { id } });
  if (!deadline || deadline.userId !== auth.userId) return badRequest("notFound", 404);

  await prisma.deadline.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
