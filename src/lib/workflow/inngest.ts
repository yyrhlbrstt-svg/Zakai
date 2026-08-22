import { Inngest, eventType, staticSchema } from "inngest";

/**
 * The Inngest client, and the closed set of events it will accept.
 *
 * WHY A CLOSED SET
 *
 * The same reason `EVENT_TYPES` in the spine is closed. A workflow keyed on
 * free-text event names is one typo away from a case that waits fourteen days
 * for a message that will never arrive under that spelling — and nothing about
 * that failure is visible, because it looks exactly like an institution
 * ignoring us. Declared this way, a typo is a type error.
 *
 * `staticSchema` gives the types without pulling validation into the hot path.
 * These events are emitted by our own server code, never by a stranger, so the
 * boundary worth validating is the webhook that *precedes* them — which zod
 * already guards at the API route.
 */

export const caseOpened = eventType("case/opened", {
  schema: staticSchema<{ caseId: string; userId: string }>(),
});

/**
 * The institution answered.
 *
 * `outboxId` identifies the specific inbound message and is what makes a
 * duplicate webhook harmless: it becomes the idempotency key, so the same
 * reply delivered twice resumes the workflow once.
 */
export const institutionReplied = eventType("case/institution.replied", {
  schema: staticSchema<{
    caseId: string;
    outboxId: string;
    kind: "settled" | "denied" | "countered";
  }>(),
});

/** The person approved the next step on their own case. */
export const mandateApproved = eventType("case/mandate.approved", {
  schema: staticSchema<{ caseId: string; authorizationId: string }>(),
});

export const inngest = new Inngest({
  id: "zakai",
  /**
   * Absent in every environment until somebody creates the account. Sending
   * without a key is dropped locally rather than thrown, so a missing key
   * degrades to "the durable path does nothing" instead of "every case
   * creation 500s" — and `durableWorkflowReady` below is what callers check
   * before routing anything here at all.
   */
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * Can the durable path actually work right now?
 *
 * Deliberately separate from the feature flag. The flag is the decision to
 * turn it on; this is whether it is physically able to run. Turning the flag
 * on without credentials must not swallow cases silently — the caller checks
 * both and falls back to the existing cron path when either is missing.
 */
export function durableWorkflowReady(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}
