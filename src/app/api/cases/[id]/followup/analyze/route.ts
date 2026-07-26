import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { analyzeProviderReply, FollowUpError } from "@/lib/services/followup";

const schema = z.object({ replyText: z.string().trim().min(2) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const result = await analyzeProviderReply({
      caseId: id,
      userId: auth.userId,
      replyText: parsed.data.replyText,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FollowUpError) {
      const status = err.message === "NOT_FOUND" ? 404 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
