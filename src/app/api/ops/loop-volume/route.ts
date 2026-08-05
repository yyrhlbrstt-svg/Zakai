import { NextResponse } from "next/server";
import { isInternalOpsRequest } from "@/lib/ops/internalAdminGate";
import { emailConfigured } from "@/lib/messaging";
import { loadLoopVolume } from "@/lib/services/loopVolume";

export const dynamic = "force-dynamic";

/**
 * Internal JSON: Mandates sent · SavingsProofs · completion by vertical.
 * GET ?internal=1 + header X-Zakai-Admin-Token.
 */
export async function GET(request: Request) {
  if (!isInternalOpsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const snap = await loadLoopVolume(emailConfigured());
  return NextResponse.json({
    /** Cases in SENT|SAVED|NO_SAVING — the loop send volume. */
    casesSentPlus: snap.mandatesSent,
    /** Alias kept for founder scripts that already key on mandatesSent. */
    mandatesSent: snap.mandatesSent,
    mandatesActive: snap.mandatesActive,
    mandatesIssued7d: snap.mandatesIssued7d,
    proofsDocumented: snap.proofsDocumented,
    proofsDocumented7d: snap.proofsDocumented7d,
    casesOpened: snap.casesOpened,
    overallSendRatePct: snap.overallSendRatePct,
    overallProofRatePct: snap.overallProofRatePct,
    sentWaitingProof: snap.sentWaitingProof,
    smtpConfigured: snap.smtpConfigured,
    byVertical: snap.byVertical.map((v) => ({
      id: v.id,
      opened: v.opened,
      mandatesSent: v.mandatesSent,
      proofsDocumented: v.proofsDocumented,
      sendRatePct: v.sendRatePct,
      proofRatePct: v.proofRatePct,
    })),
  });
}
