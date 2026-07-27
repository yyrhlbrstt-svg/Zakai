import "server-only";
import { prisma } from "@/lib/prisma";
import { paymentProvider, paymentProviderName } from "@/lib/payments";

export class PaymentError extends Error {}

/**
 * Start collecting a case's success fee. Loads the PENDING fee for a case the
 * user owns, asks the active PSP for a hosted checkout, records the provider +
 * reference, and returns the URL to send the payer to. Idempotent-ish: a fee
 * already PAID is rejected; a WAIVED fee has nothing to collect.
 */
export async function initiateFeePayment(
  caseId: string,
  userId: string,
  origin: string,
): Promise<{ checkoutUrl: string }> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: { fee: true },
  });
  if (!kase || !kase.fee) throw new PaymentError("NO_FEE");
  const fee = kase.fee;
  if (fee.status === "PAID") throw new PaymentError("ALREADY_PAID");
  if (fee.status === "WAIVED" || fee.amount <= 0) throw new PaymentError("NOTHING_TO_COLLECT");

  const provider = paymentProvider();
  const returnUrl = `${origin.replace(/\/+$/, "")}/api/payments/callback`;
  const checkout = await provider.createCheckout({
    feeId: fee.id,
    amountAgorot: fee.amount,
    description: `Zakai success fee — case ${kase.id}`,
    returnUrl,
  });

  await prisma.fee.update({
    where: { id: fee.id },
    data: { provider: paymentProviderName(), providerRef: checkout.providerRef },
  });

  return { checkoutUrl: checkout.checkoutUrl };
}

/**
 * Confirm a fee as collected. Called by the PSP webhook / return callback with
 * the fee id and the provider reference. Verifies the reference matches what we
 * stored (a real adapter also verifies the webhook signature), then flips the
 * fee to PAID exactly once. Safe to call twice — a PAID fee stays PAID.
 */
export async function confirmFeePayment(feeId: string, providerRef: string): Promise<boolean> {
  const fee = await prisma.fee.findUnique({ where: { id: feeId } });
  if (!fee) return false;
  if (fee.status === "PAID") return true; // idempotent
  if (!fee.providerRef || fee.providerRef !== providerRef) return false;

  await prisma.fee.update({
    where: { id: feeId },
    data: { status: "PAID", paidAt: new Date() },
  });
  return true;
}
