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

export async function register(): Promise<void> {
  // Reserved for future initialization (e.g. Sentry.init) — intentionally empty.
}
