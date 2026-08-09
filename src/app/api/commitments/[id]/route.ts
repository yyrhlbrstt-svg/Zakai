import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { CommitmentError, endCommitment } from "@/lib/services/commitments";

/**
 * End a commitment — cancelled, expired, or switched away from.
 *
 * DELETE by verb only. The row is kept and stamped, never removed: what
 * somebody used to pay for is the half of the record that proves a
 * cancellation actually happened, and it is the half they will want when a
 * company claims the contract is still running.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  try {
    await endCommitment(id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CommitmentError) return badRequest(err.code, 404);
    throw err;
  }
}
