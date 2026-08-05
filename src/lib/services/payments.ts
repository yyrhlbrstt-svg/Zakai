import "server-only";
import { randomUUID } from "crypto";
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
  locale = "he",
): Promise<{ checkoutUrl: string }> {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: { fee: true },
  });
  if (!kase || !kase.fee) throw new PaymentError("NO_FEE");
  let fee = kase.fee;
  if (fee.status === "PAID") throw new PaymentError("ALREADY_PAID");
  if (fee.status === "WAIVED" || fee.amount <= 0) throw new PaymentError("NOTHING_TO_COLLECT");
  // Never collect under withdrawn / unbound authority — even when Fee.mandateJti
  // was already set at settle (revoke-after-SAVED must still block checkout).
  // Legacy PENDING rows may heal jti from ACTIVE Authorization; never mint here.
  const auth = await prisma.authorization.findUnique({
    where: { caseId },
    select: { mandateJti: true, status: true },
  });
  if (!auth || auth.status !== "ACTIVE" || !auth.mandateJti) {
    throw new PaymentError("MANDATE_REQUIRED");
  }
  if (!fee.mandateJti) {
    fee = await prisma.fee.update({
      where: { id: fee.id },
      data: { mandateJti: auth.mandateJti },
    });
  } else if (fee.mandateJti !== auth.mandateJti) {
    // Fee still points at a prior jti (e.g. after reissue) — do not collect.
    throw new PaymentError("MANDATE_REQUIRED");
  }

  // Claim the fee before minting a live checkout link. Without this, two
  // overlapping requests (a double-click on "pay now", or the same fee open
  // in two tabs) both pass the PENDING check above and both call the PSP —
  // each mints its own real, independently-payable hosted checkout, and the
  // second prisma.fee.update below silently overwrites the first checkout's
  // providerRef. If the payer completes the checkout that lost that race,
  // confirmFeePayment's exact-match check on providerRef then fails and a
  // real captured payment can never be reconciled to PAID. The where-clause
  // pins the exact providerRef we just read as an optimistic-concurrency
  // check — matches the claim shape already used for sendOutreach and the
  // Outbox drain worker — so a losing concurrent call fails fast instead of
  // reaching the PSP at all.
  const claimMarker = `pending:${randomUUID()}`;
  const claimed = await prisma.fee.updateMany({
    where: { id: fee.id, status: "PENDING", providerRef: fee.providerRef },
    data: { providerRef: claimMarker },
  });
  if (claimed.count === 0) throw new PaymentError("CHECKOUT_IN_PROGRESS");

  const provider = paymentProvider();
  const loc = encodeURIComponent(locale);
  // feeId must survive the PayPlus browser bounce — GET verify is fail-closed,
  // so the callback needs feeId to deep-link /money?case=&payFee=1 on error/confirming.
  const returnUrl = `${origin.replace(/\/+$/, "")}/api/payments/callback?loc=${loc}&feeId=${encodeURIComponent(fee.id)}`;
  let checkout: { checkoutUrl: string; providerRef: string };
  try {
    checkout = await provider.createCheckout({
      feeId: fee.id,
      amountAgorot: fee.amount,
      description: `Zakai success fee — case ${kase.id}`,
      returnUrl,
    });
  } catch (err) {
    // Release the claim so a retry isn't permanently stuck matching a stale marker.
    await prisma.fee.updateMany({
      where: { id: fee.id, providerRef: claimMarker },
      data: { providerRef: null },
    });
    throw err;
  }

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
