import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";

export type WebhookEvent =
  | "case.created"
  | "case.sent"
  | "case.saved"
  | "case.no_saving"
  | "case.rejected"
  | "case.followup";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  partnerRef: string | null;
  caseId: string;
  status: string;
  provider: string;
  amountOriginalShekels: number;
  targetShekels: number;
  savingMonthlyShekels: number | null;
  feeShekels: number | null;
}

/**
 * Notify a partner when a case they originated changes status.
 * Delivered asynchronously (fire-and-forget) so the core flow never waits.
 */
export async function dispatchPartnerWebhook(caseId: string, event: WebhookEvent) {
  const link = await prisma.partnerCaseLink.findFirst({
    where: { caseId },
    include: {
      partner: true,
      case: { include: { savingsProof: true, fee: true } },
    },
  });
  if (!link || !link.partner.webhookUrl) return; // no partner or no webhook configured

  const kase = link.case;
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    partnerRef: link.partnerRef,
    caseId: kase.id,
    status: kase.status,
    provider: kase.provider,
    amountOriginalShekels: kase.amountOriginal / 100,
    targetShekels: kase.targetAmount / 100,
    savingMonthlyShekels: kase.savingsProof?.savingMonthly
      ? kase.savingsProof.savingMonthly / 100
      : null,
    feeShekels: kase.fee?.amount ? kase.fee.amount / 100 : null,
  };

  // Run in background promise; failures are logged, not thrown.
  deliver(link.partner.webhookUrl, payload, link.partner.id).catch((err) => {
    reportError(err, { caseId, event, partnerId: link.partner.id });
  });
}

async function deliver(url: string, payload: WebhookPayload, partnerId: string) {
  const body = JSON.stringify(payload);
  const signature = signPayload(body);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Zakai-Signature": signature,
      "X-Zakai-Partner-Id": partnerId,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

function signPayload(body: string): string {
  const secret = process.env.WEBHOOK_SIGNING_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
