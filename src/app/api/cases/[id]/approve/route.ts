import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { approveCase, refreshVerifiedStatus, CaseError } from "@/lib/services/cases";

const schema = z.object({ editedMessage: z.string().max(5000).optional() });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  const editedMessage = parsed.success ? parsed.data.editedMessage : undefined;

  try {
    await approveCase(id, auth.userId, editedMessage);
    await refreshVerifiedStatus(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CaseError) return badRequest(err.message, 404);
    throw err;
  }
}
