import "server-only";

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

export interface PaymentProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
}

/**
 * The default provider: no real PSP yet. It sends the payer to an internal
 * confirmation page that stands in for a hosted checkout, so the flow works in
 * dev and demos. It NEVER moves real money.
 */
class MockProvider implements PaymentProvider {
  name = "mock";
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerRef = `mock_${input.feeId}_${Date.now()}`;
    // The internal confirm page carries the fee id + ref; confirming it there
    // calls the same webhook a real PSP would.
    const url = new URL(input.returnUrl);
    url.searchParams.set("mock", "1");
    url.searchParams.set("feeId", input.feeId);
    url.searchParams.set("ref", providerRef);
    return { checkoutUrl: url.toString(), providerRef };
  }
}

/**
 * A real Israeli PSP adapter is added here (guarded by its own env vars). Left
 * as an explicit stub so the seam is obvious and going live is scoped: implement
 * `createCheckout` against the PSP's REST API (return their hosted-page URL),
 * and verify the webhook signature in the callback route.
 */
class UnconfiguredProvider implements PaymentProvider {
  constructor(public name: string) {}
  async createCheckout(): Promise<CheckoutResult> {
    throw new PaymentUnavailableError(
      `Payment provider "${this.name}" is selected but not implemented/configured yet.`,
    );
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
  // Real adapters plug in here, e.g.:
  //   if (name === "payplus") return new PayPlusProvider();
  return new UnconfiguredProvider(name);
}
