import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { sendOutreach, CaseError } from "@/lib/services/cases";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  try {
    await sendOutreach(id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CaseError) {
      const status = err.message === "NOT_FOUND" ? 404 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
