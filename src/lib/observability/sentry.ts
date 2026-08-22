/**
 * Error reporting configuration, in one place, honest about being off.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE SDK
 *
 * Sentry's own init is happy to run with no DSN — it simply drops everything.
 * That is a sensible default for a library and a bad one here, because
 * "reporting is on" and "reporting is configured" would become
 * indistinguishable, and the failure mode is the worst kind: a dashboard that
 * is quiet because nothing is broken, or quiet because nothing is listening,
 * with no way to tell which. So the answer is computed once, here, and the
 * pre-demo checklist reads it.
 */

import { flagEnabled } from "@/lib/flags";

export function sentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

/**
 * Both must hold: a DSN to send to, and the flag saying we mean it.
 *
 * Separate on purpose. The DSN answers "can this work"; the flag answers "did
 * somebody decide". A DSN pasted into an env var during setup should not start
 * shipping users' stack traces to a third party the same minute.
 */
export function errorReportingActive(): boolean {
  return Boolean(sentryDsn()) && flagEnabled("errorReporting");
}

/**
 * Shared options.
 *
 * `sendDefaultPii` is false and must stay false. This product handles bank
 * statements, case evidence and signed authority; a crash report carrying the
 * request body would move exactly the data the Mandate exists to protect into
 * somebody else's system. Breadcrumbs are capped for the same reason — a long
 * trail is a long trail of somebody's session.
 */
export function baseSentryOptions() {
  return {
    dsn: sentryDsn(),
    enabled: errorReportingActive(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    /** 10% of transactions: enough to see a trend, cheap enough to leave on. */
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    maxBreadcrumbs: 20,
  };
}
