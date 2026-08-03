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
    mandatesSent: snap.mandatesSent,
    proofsDocumented: snap.proofsDocumented,
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
