import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { recordSaving, CaseError } from "@/lib/services/cases";
import { initiateFeePayment, PaymentError } from "@/lib/services/payments";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { absoluteLocaleUrl, localeForCountry } from "@/lib/localePath";

const CONFIRM_TTL_SECONDS = 48 * 60 * 60;
const DEV_ONLY_FALLBACK_SECRET =
  "zakai-insecure-development-only-secret-do-not-use-in-production";

function confirmSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET required for proposed-saving confirm links");
  }
  return new TextEncoder().encode(DEV_ONLY_FALLBACK_SECRET);
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
}

/**
 * Signed one-tap confirm for inbound-proposed SavingsProof.
 * User click is the gate — never auto-charge. Token binds case + amount.
 */
export async function issueProposedSavingConfirmUrl(opts: {
  userId: string;
  caseId: string;
  newAmountShekels: number;
  country?: string | null;
}): Promise<string | null> {
  if (!Number.isFinite(opts.newAmountShekels) || opts.newAmountShekels < 0) return null;
  if (opts.newAmountShekels > 100_000) return null;

  const token = await new SignJWT({
    purpose: "proposed_saving",
    userId: opts.userId,
    caseId: opts.caseId,
    newAmountShekels: Math.round(opts.newAmountShekels),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CONFIRM_TTL_SECONDS}s`)
    .sign(confirmSecret());

  return absoluteLocaleUrl(
    appBaseUrl(),
    localeForCountry(opts.country),
    `/saving/confirm?token=${encodeURIComponent(token)}`,
  );
}

export type ConsumeProposedSavingResult =
  | {
      ok: true;
      caseId: string;
      chargeable: boolean;
      paymentsLive: boolean;
      checkoutUrl?: string;
      alreadySettled?: boolean;
    }
  | { ok: false; error: "invalid" | "expired" | "not_found" | "not_sent" | "auth" | "generic" };

/** Consume a confirm token and record the inbound-proposed amount. */
export async function consumeProposedSavingConfirm(
  token: string,
  origin?: string,
): Promise<ConsumeProposedSavingResult> {
  let payload: {
    purpose?: string;
    userId?: string;
    caseId?: string;
    newAmountShekels?: number;
  };
  try {
    const verified = await jwtVerify(token, confirmSecret());
    payload = verified.payload as typeof payload;
  } catch {
    return { ok: false, error: "expired" };
  }

  if (
    payload.purpose !== "proposed_saving" ||
    !payload.userId ||
    !payload.caseId ||
    typeof payload.newAmountShekels !== "number"
  ) {
    return { ok: false, error: "invalid" };
  }

  const kase = await prisma.case.findUnique({
    where: { id: payload.caseId },
    select: {
      id: true,
      userId: true,
      status: true,
      savingsProof: { select: { id: true } },
    },
  });
  if (!kase) return { ok: false, error: "not_found" };
  if (kase.userId !== payload.userId) return { ok: false, error: "auth" };

  if (kase.savingsProof) {
    return {
      ok: true,
      caseId: kase.id,
      chargeable: false,
      paymentsLive: paymentsFullyLive(),
      alreadySettled: true,
    };
  }
  if (kase.status !== "SENT") return { ok: false, error: "not_sent" };

  try {
    const result = await recordSaving(kase.id, payload.userId, payload.newAmountShekels, {
      source: "inbound",
    });
    const paymentsLive = paymentsFullyLive();
    let checkoutUrl: string | undefined;
    if (result.feeNet > 0 && paymentsLive && origin) {
      try {
        const checkout = await initiateFeePayment(
          kase.id,
          payload.userId,
          origin,
          "he",
        );
        checkoutUrl = checkout.checkoutUrl;
      } catch (err) {
        if (!(err instanceof PaymentError)) throw err;
      }
    }
    return {
      ok: true,
      caseId: kase.id,
      chargeable: result.feeNet > 0,
      paymentsLive,
      checkoutUrl,
    };
  } catch (err) {
    if (err instanceof CaseError) {
      if (err.message === "ALREADY_SETTLED") {
        return {
          ok: true,
          caseId: kase.id,
          chargeable: false,
          paymentsLive: paymentsFullyLive(),
          alreadySettled: true,
        };
      }
      if (err.message === "AUTH_REVOKED" || err.message === "MANDATE_REQUIRED") {
        return { ok: false, error: "auth" };
      }
      if (err.message === "NOT_SENT") return { ok: false, error: "not_sent" };
    }
    return { ok: false, error: "generic" };
  }
}
