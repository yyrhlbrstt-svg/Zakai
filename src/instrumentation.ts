import { reportError } from "@/lib/report-error";

/**
 * Next.js instrumentation. `onRequestError` fires for every unhandled server
 * error (route handlers, RSC, etc.) and routes it into our error reporter, so
 * failures are captured centrally instead of vanishing.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
): Promise<void> {
  await reportError(err, { path: request?.path, method: request?.method });
}

/**
 * Refuse to boot a production deployment that cannot address itself.
 *
 * The ownership magic link — the only path that verifies a case without an SMS
 * gateway — is built as:
 *
 *     process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
 *
 * (src/lib/services/ownership.ts). With the variable unset, a real person gets
 * a real email, from a verified domain, carrying a link to localhost. They
 * click it, nothing happens, and there is no error anywhere: the Outbox says
 * SENT, the logs are clean, and the product looks broken rather than
 * misconfigured. That is the most expensive kind of failure this codebase can
 * have, because it costs a real user their one attempt and tells nobody.
 *
 * Note that other call sites fall back to the production URL instead
 * (appBaseUrl in services/cases.ts), so the same missing variable is harmless
 * in most places and fatal in one. A guard is the only thing that makes the
 * fatal case visible.
 *
 * Scoped to genuine production deployments on purpose. Vercel builds previews
 * with NODE_ENV=production too, and a preview that has never had this variable
 * is not a place real mail is sent — crashing it would trade a silent bug for
 * a loud one in the wrong environment.
 */
function assertSelfAddressable(): void {
  const isVercelPreview =
    process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development";
  const isProductionDeploy = process.env.NODE_ENV === "production" && !isVercelPreview;
  if (!isProductionDeploy) return;

  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. In production this is fatal: ownership " +
        "magic links would be emailed pointing at http://localhost:3000, which " +
        "fails silently for the recipient. Set it to this deployment's public " +
        "origin (e.g. https://zakai-3uxj.vercel.app) and redeploy — environment " +
        "variables only take effect on a new build.",
    );
  }

  // Presence is not enough: "zakai-3uxj.vercel.app" without a scheme produces a
  // relative-looking link that breaks in exactly the same invisible way.
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_APP_URL is not an absolute URL (got "${raw}"). It must include ` +
        'the scheme, e.g. "https://zakai-3uxj.vercel.app".',
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be an http(s) URL (got "${parsed.protocol}").`,
    );
  }
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    throw new Error(
      `NEXT_PUBLIC_APP_URL points at ${parsed.hostname} in a production deployment. ` +
        "Every emailed link would be unreachable for its recipient.",
    );
  }
}

export async function register(): Promise<void> {
  // Node runtime only. `register` also runs on the edge runtime, where this
  // would fire a second time for the same deployment and say nothing new.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  assertSelfAddressable();
}
