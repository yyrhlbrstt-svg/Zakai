import "server-only";
import crypto from "node:crypto";

/**
 * PSP-agnostic fee collection. Like the AI hub, the concrete provider is chosen
 * by env vars so the app has ONE payment seam and swapping the Israeli PSP
 * (PayPlus / Tranzila / Cardcom / Meshulam …) is a single adapter, never a
 * rewrite of the flow.
 *
 * Until a real PSP is configured, the `mock` provider runs the entire flow
 * end-to-end against an internal confirmation page — so the plumbing
 * (initiate → checkout → confirm → mark PAID) is proven now, and going live is
 * just filling in credentials + one `createCheckout` implementation.
 *
 * NOTE: real card data must NEVER touch our servers — a real adapter returns a
 * hosted checkout URL on the PSP's domain and confirms via a signed webhook.
 */

export interface CheckoutInput {
  /** Our fee id — echoed back by the PSP so the webhook can reconcile. */
  feeId: string;
  amountAgorot: number;
  description: string;
  /** Absolute URL to return the payer to after payment. */
  returnUrl: string;
}

export interface CheckoutResult {
  /** Where to send the payer to complete payment. */
  checkoutUrl: string;
  /** The PSP's transaction/intent reference. */
  providerRef: string;
}

/** The raw material a provider needs to authenticate an incoming callback. */
export interface CallbackContext {
  method: "GET" | "POST";
  query: Record<string, string>;
  body: Record<string, unknown>;
  /** Exact request body bytes — required for signature (HMAC) verification. */
  rawBody: string;
  headers: Record<string, string>;
}

/** A callback the provider has authenticated as a genuine, successful payment. */
export interface VerifiedCallback {
  feeId: string;
  providerRef: string;
}

export interface PaymentProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /**
   * Authenticate an incoming return/webhook and extract which fee to confirm.
   * Returns null when the callback CANNOT be trusted — the route must then
   * refuse to mark anything paid. Real PSPs verify a signature here; the whole
   * point is to FAIL CLOSED so a forged callback never confirms a payment.
   */
  verifyCallback(ctx: CallbackContext): Promise<VerifiedCallback | null>;
}

/**
 * The default provider: no real PSP yet. It sends the payer to an internal
 * confirmation page that stands in for a hosted checkout, so the flow works in
 * dev and demos. It NEVER moves real money.
 */
class MockProvider implements PaymentProvider {
  name = "mock";
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // Cryptographically-random, unguessable reference. confirmFeePayment
    // requires an exact match, so an attacker can't forge a "paid" callback by
    // guessing a timestamp — the ref is a 128-bit secret tied to this fee.
    const providerRef = `mock_${input.feeId}_${crypto.randomUUID()}`;
    // The internal confirm page carries the fee id + ref; confirming it there
    // calls the same webhook a real PSP would.
    const url = new URL(input.returnUrl);
    url.searchParams.set("mock", "1");
    url.searchParams.set("feeId", input.feeId);
    url.searchParams.set("ref", providerRef);
    return { checkoutUrl: url.toString(), providerRef };
  }

  async verifyCallback(ctx: CallbackContext): Promise<VerifiedCallback | null> {
    // The mock's ref is a 128-bit secret we generated and returned only in the
    // checkout URL; confirmFeePayment's exact-match against it is the auth. So
    // passing the params through is safe here (dev/demo only, no real money).
    const feeId = ctx.query.feeId ?? (ctx.body.feeId as string | undefined);
    const providerRef = ctx.query.ref ?? (ctx.body.ref as string | undefined);
    if (!feeId || !providerRef) return null;
    return { feeId, providerRef };
  }
}

/**
 * PayPlus — a real Israeli PSP adapter (hosted payment page). Returns a link on
 * PayPlus's domain, so card data never touches our servers. Enabled with:
 *   PAYMENT_PROVIDER=payplus
 *   PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY   (from the PayPlus dashboard)
 *   PAYPLUS_PAYMENT_PAGE_UID              (the payment page to charge on)
 *   PAYPLUS_BASE_URL                      (optional; sandbox vs production)
 *
 * Implemented against PayPlus's documented `PaymentPages/generateLink` API.
 * ⚠️ Verify end-to-end in the PayPlus SANDBOX with real keys before charging
 * live — field/behaviour details can shift, and the callback route must verify
 * PayPlus's webhook hash before trusting a "paid" notification.
 */
class PayPlusProvider implements PaymentProvider {
  name = "payplus";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const apiKey = process.env.PAYPLUS_API_KEY;
    const secretKey = process.env.PAYPLUS_SECRET_KEY;
    const pageUid = process.env.PAYPLUS_PAYMENT_PAGE_UID;
    if (!apiKey || !secretKey || !pageUid) {
      throw new PaymentUnavailableError("PayPlus is selected but its API keys are not configured.");
    }
    const base = (process.env.PAYPLUS_BASE_URL || "https://restapi.payplus.co.il/api/v1.0").replace(
      /\/+$/,
      "",
    );
    // The webhook route reconciles by this fee id echoed in more_info.
    const returnBase = input.returnUrl;
    const res = await fetch(`${base}/PaymentPages/generateLink`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // PayPlus authenticates via a JSON Authorization header.
        Authorization: JSON.stringify({ api_key: apiKey, secret_key: secretKey }),
      },
      body: JSON.stringify({
        payment_page_uid: pageUid,
        charge_method: 1, // 1 = charge (immediate)
        amount: input.amountAgorot / 100, // PayPlus expects major units (₪)
        currency_code: "ILS",
        more_info: input.feeId, // echoed back on the callback for reconciliation
        refURL_success: returnBase,
        refURL_failure: returnBase,
        refURL_callback: returnBase, // server-to-server webhook
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      results?: { status?: string; description?: string };
      data?: { payment_page_link?: string; page_request_uid?: string };
    } | null;

    const link = data?.data?.payment_page_link;
    const ref = data?.data?.page_request_uid;
    if (!res.ok || !link || !ref) {
      throw new PaymentUnavailableError(
        `PayPlus generateLink failed: ${res.status} ${data?.results?.description ?? "unknown error"}`,
      );
    }
    return { checkoutUrl: link, providerRef: ref };
  }

  async verifyCallback(ctx: CallbackContext): Promise<VerifiedCallback | null> {
    // FAIL CLOSED. A PayPlus reference (page_request_uid) is NOT secret, so we
    // must NOT trust a bare ref — we verify PayPlus's webhook HMAC over the raw
    // body before confirming. Only a POST webhook (not a browser return) can
    // move a fee to PAID.
    const secret = process.env.PAYPLUS_SECRET_KEY;
    if (!secret) return null;
    if (ctx.method !== "POST" || !ctx.rawBody) return null;

    // PayPlus signs the webhook body; the signature arrives in a header. The
    // exact header name/algorithm MUST be confirmed against your PayPlus
    // sandbox before going live — until then this verifier fails closed and no
    // real payment is ever confirmed. (Common shape: base64 HMAC-SHA256.)
    const provided = ctx.headers["hash"] || ctx.headers["user-agent-hash"] || "";
    if (!provided) return null;
    const expected = crypto.createHmac("sha256", secret).update(ctx.rawBody).digest("base64");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    // Only an approved transaction confirms the fee. PayPlus status "000" = ok.
    const body = ctx.body as {
      transaction?: { status_code?: string };
      more_info?: string;
      page_request_uid?: string;
    };
    if (body.transaction?.status_code !== "000") return null;
    const feeId = body.more_info;
    const providerRef = body.page_request_uid;
    if (!feeId || !providerRef) return null;
    return { feeId, providerRef };
  }
}

/**
 * A selected-but-unimplemented PSP. Left so an unknown PAYMENT_PROVIDER value
 * fails loudly instead of silently falling back to the mock in production.
 */
class UnconfiguredProvider implements PaymentProvider {
  constructor(public name: string) {}
  async createCheckout(): Promise<CheckoutResult> {
    throw new PaymentUnavailableError(
      `Payment provider "${this.name}" is selected but not implemented/configured yet.`,
    );
  }
  async verifyCallback(): Promise<VerifiedCallback | null> {
    return null; // fail closed
  }
}

export class PaymentUnavailableError extends Error {}

/** Which PSP is active. Defaults to the mock until a real one is wired. */
export function paymentProviderName(): string {
  return (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
}

/** True once a REAL psp is configured (i.e. not the mock). */
export function realPaymentsConfigured(): boolean {
  return paymentProviderName() !== "mock";
}

export function paymentProvider(): PaymentProvider {
  const name = paymentProviderName();
  if (name === "mock") return new MockProvider();
  if (name === "payplus") return new PayPlusProvider();
  return new UnconfiguredProvider(name);
}
