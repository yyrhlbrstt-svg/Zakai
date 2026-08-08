import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hand the signed settlement to the person it belongs to.
 *
 * A record the holder does not hold is still ours. Everything that makes a
 * settlement worth signing — that a counterparty can check it, that a
 * regulator can weigh it, that it survives this company — depends on the
 * person actually having the bytes, somewhere we cannot reach. Leaving it in
 * our database and calling it theirs would be the same "built but
 * unreachable" failure this codebase keeps producing.
 *
 * Owner-scoped, unlike the public verifier. Verification needs no
 * authentication because the token carries no person; RETRIEVAL does, because
 * knowing a case id would otherwise be enough to learn what somebody
 * recovered and from whom.
 *
 * Served as a download rather than JSON: the useful thing is a file the person
 * keeps, forwards, or attaches to a complaint, not a response they have to
 * copy out of a developer console.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("case-settlement", auth.userId, 60, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const { id } = await params;

  const proof = await prisma.savingsProof.findFirst({
    // The userId predicate is the access check. Selecting by case id alone and
    // filtering afterwards is how one of these ends up leaking.
    where: { caseId: id, case: { userId: auth.userId } },
    select: { settlementJws: true, recordedAt: true },
  });

  if (!proof) return badRequest("notFound", 404);

  if (!proof.settlementJws) {
    // Distinguished from "no such case": this settlement is real, it simply
    // predates signing or was recorded while no signing key was configured.
    // Telling the holder it does not exist would be false.
    return NextResponse.json(
      {
        error: "notSigned",
        message:
          "This settlement was recorded before signing was available, or while no signing key was configured. The saving itself is unaffected.",
      },
      { status: 409 },
    );
  }

  const stamp = proof.recordedAt.toISOString().slice(0, 10);
  return new NextResponse(proof.settlementJws, {
    headers: {
      "Content-Type": "application/jwt",
      "Content-Disposition": `attachment; filename="zakai-settlement-${stamp}.jwt"`,
      // Never cached by a shared proxy: this is one person's record.
      "Cache-Control": "private, no-store",
    },
  });
}
