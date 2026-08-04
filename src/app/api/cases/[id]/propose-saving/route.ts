import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { CaseError } from "@/lib/services/cases";
import { proposeSavingFromText } from "@/lib/services/proposeSavingFromText";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  text: z.string().min(8).max(50_000),
});

/**
 * Paste a provider reply on a SENT case → Outbox inbound proposal for
 * one-tap SavingsProof (same shape as /api/inbound-email).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("case-propose-saving", auth.userId, 30, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const { proposed, extract, recordAmountShekels } = await proposeSavingFromText(
      id,
      auth.userId,
      parsed.data.text,
    );
    return NextResponse.json({
      ok: true,
      proposed: proposed
        ? {
            newAmountShekels: proposed.newAmountShekels,
            confidence: proposed.confidence,
            from: proposed.from,
          }
        : null,
      /** Mapped remaining/monthly for recordSaving — never one-tap raw extract. */
      recordAmountShekels,
      extract: {
        found: extract.found,
        newAmountShekels: extract.newAmountShekels,
        confidence: extract.confidence,
        reason: extract.reason ?? null,
        amountKind: extract.amountKind ?? null,
      },
    });
  } catch (err) {
    if (err instanceof CaseError) {
      const status =
        err.message === "NOT_FOUND" ? 404 : err.message === "EMPTY_TEXT" ? 400 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
