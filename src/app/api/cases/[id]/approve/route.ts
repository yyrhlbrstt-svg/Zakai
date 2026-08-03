import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { approveCase, CaseError } from "@/lib/services/cases";
import { primeCaseForFastSend } from "@/lib/services/primeCase";
import { clientIp } from "@/lib/ratelimit";

const schema = z.object({
  editedMessage: z.string().max(5000).optional(),
  counterpartyEmail: z.string().max(120).optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  const editedMessage = parsed.success ? parsed.data.editedMessage : undefined;

  try {
    await approveCase(
      id,
      auth.userId,
      editedMessage,
      clientIp(request),
      parsed.success ? parsed.data.counterpartyEmail : undefined,
    );
    const { ownershipViaEmail } = await primeCaseForFastSend(auth.userId, id);
    return NextResponse.json({ ok: true, ownershipViaEmail });
  } catch (err) {
    if (err instanceof CaseError) {
      const status =
        err.message === "NOT_FOUND"
          ? 404
          : err.message === "ALREADY_SENT"
            ? 409
            : 400;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
