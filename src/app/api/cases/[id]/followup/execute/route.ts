import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { executeReplyAction, type ParsedProviderReply, FollowUpError } from "@/lib/services/followup";

const outcomeSchema = z.enum(["saving_accepted", "rejected", "needs_info", "unclear", "no_reply_needed"]);
const actionSchema = z.enum(["record_saving", "send_followup", "ask_user", "wait"]);

const schema = z.object({
  outcome: outcomeSchema,
  newAmountShekels: z.number().min(0).max(100000).optional(),
  summaryHe: z.string().min(1),
  suggestedAction: actionSchema,
  missingInfo: z.string().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const reply: ParsedProviderReply = parsed.data;

  try {
    const result = await executeReplyAction({ caseId: id, userId: auth.userId, parsed: reply });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FollowUpError) {
      const status = err.message === "NOT_FOUND" ? 404 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
