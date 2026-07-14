/**
 * Basic, provider-agnostic error reporting.
 *
 * - Always logs a structured line to stderr, which the host (Vercel) captures
 *   in its Logs — the baseline "error monitoring" that works today.
 * - If `SENTRY_DSN` is set AND `@sentry/nextjs` is installed, forwards the
 *   exception to Sentry. The import specifier is assembled at runtime so the
 *   bundler never tries to resolve the package at build time — installing
 *   Sentry later needs no code change, and its absence never breaks the build.
 */
export async function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const payload = {
    level: "error",
    at: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };
  console.error("[zakai:error]", JSON.stringify(payload));

  if (!process.env.SENTRY_DSN) return;
  try {
    const specifier = ["@sentry", "nextjs"].join("/");
    const Sentry = (await import(/* webpackIgnore: true */ specifier)) as {
      captureException?: (e: unknown, hint?: unknown) => void;
    };
    Sentry.captureException?.(error, { extra: context });
  } catch {
    // Sentry not installed / not initialized — the console log above stands.
  }
}
