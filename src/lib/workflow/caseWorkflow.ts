import { NonRetriableError } from "inngest";
import { prisma } from "@/lib/prisma";
import { inngest, caseOpened, institutionReplied, mandateApproved } from "./inngest";
import { recordEvent } from "@/lib/events/spine";

/**
 * A case as a durable workflow: draft → send → wait → follow up → wait → resolve.
 *
 * WHAT THIS REPLACES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * The multi-week wait was never running on request/response — it runs on a
 * nightly cron (`responseClockJob`) that computes, for every SENT case, where
 * its response window stands. That works, and it is what production runs
 * today. What it cannot do is express the *shape* of a case as one readable
 * sequence: the ordering lives implicitly across several jobs, and adding a
 * rung means teaching another job about it.
 *
 * So this exists alongside that path, behind a flag, and the flag is off. Two
 * orchestrators writing the same Case rows is how a letter gets sent twice,
 * and a duplicate demand to an institution is the single most expensive bug
 * this product could ship — it costs the user's credibility, not ours.
 *
 * THE TIMEOUT FALLBACK IS "FLAG FOR REVIEW", NOT "AUTO-FOLLOW-UP"
 *
 * The brief offered either. Only one is available to this codebase:
 * non-negotiable #5 is that product code executes after explicit user action,
 * and `responseClockJob` states the same law in its own words — "the clock
 * names what is due, it never sends anything". A workflow that posted a
 * follow-up on a timer would be the product acting on somebody's behalf
 * without them, which is exactly the line the Mandate exists to draw. So a
 * timeout records that the window closed and surfaces the case; a human still
 * presses send.
 *
 * IDEMPOTENCY
 *
 * Every resume carries the id of the thing that caused it — an Outbox row for
 * a reply, an Authorization for an approval. `claimResume` writes that id into
 * IdempotencyRecord under a unique (scope, actor, key), so the second delivery
 * of the same webhook loses the race and returns false. No new model: the
 * table already exists for exactly this.
 */

/** Bounds, stated once. An unbounded wait is a case nobody ever looks at again. */
export const REPLY_WINDOW = "14d";
export const APPROVAL_WINDOW = "7d";

/**
 * Claim the right to act on a resume exactly once.
 *
 * Returns false when this (case, step, cause) has already been handled, which
 * is the normal outcome of a duplicate webhook rather than an error.
 */
export async function claimResume(
  caseId: string,
  step: string,
  causeId: string,
): Promise<boolean> {
  try {
    await prisma.idempotencyRecord.create({
      data: {
        scope: `workflow:${step}`,
        actorId: caseId,
        key: causeId,
        statusCode: 200,
        responseJson: "{}",
        // Longer than the longest wait, so a duplicate cannot sneak through
        // after the record expires but before the workflow has moved on.
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return true;
  } catch {
    // Unique violation on (scope, actorId, key) — already claimed.
    return false;
  }
}

/** Flag a case for a person to look at. Never sends anything. */
async function flagForReview(caseId: string, reason: string): Promise<void> {
  await recordEvent({
    eventType: "policy.observed",
    caseId,
    payload: {
      policyType: "workflow_timeout",
      description: reason.slice(0, 300),
      firstObservedViaCaseId: caseId,
    },
  });
}

export const caseLifecycle = inngest.createFunction(
  {
    id: "case-lifecycle",
    /**
     * One run per case. A second `case/opened` for the same id is dropped
     * rather than starting a rival workflow over the same rows.
     */
    idempotency: "event.data.caseId",
    retries: 3,
    triggers: caseOpened,
  },
  async ({ event, step }) => {
    const { caseId } = event.data;

    const found = await step.run("load-case", async () => {
      const row = await prisma.case.findUnique({
        where: { id: caseId },
        select: { id: true, status: true, vertical: true },
      });
      if (!row) throw new NonRetriableError(`case ${caseId} does not exist`);
      return row;
    });

    // ---- draft ------------------------------------------------------------
    // The draft is built by the existing letter engine; this step records that
    // the case reached the stage, and deliberately does not re-implement any
    // of the drafting logic that already has tests around it.
    await step.run("draft", async () => {
      await recordEvent({
        eventType: "claim.created",
        caseId,
        domain: found.vertical,
        payload: { claimType: found.vertical, estimatedValueAgorot: null, source: "self_service" },
      });
      return { drafted: true };
    });

    // ---- send -------------------------------------------------------------
    // Dispatch stays with the Outbox worker, which owns transport, retries and
    // the QUEUED/SENT distinction. Duplicating it here would create the second
    // sender this whole design exists to avoid.
    await step.run("await-dispatch", async () => ({ handedToOutbox: true }));

    // ---- wait for the institution ----------------------------------------
    const reply = await step.waitForEvent("institution-reply", {
      event: institutionReplied,
      timeout: REPLY_WINDOW,
      if: `async.data.caseId == "${caseId}"`,
    });

    if (!reply) {
      await step.run("reply-window-closed", () =>
        flagForReview(caseId, `no reply within ${REPLY_WINDOW}; follow-up is due and needs a person`),
      );
      return { caseId, outcome: "flagged_no_reply" as const };
    }

    const firstToHandleReply = await step.run("claim-reply", () =>
      claimResume(caseId, "institution-reply", reply.data.outboxId),
    );
    if (!firstToHandleReply) return { caseId, outcome: "duplicate_reply_ignored" as const };

    // ---- follow up --------------------------------------------------------
    await step.run("record-reply", async () => {
      await recordEvent({
        eventType: "institution.responded",
        caseId,
        payload: {
          responseType: reply.data.kind === "settled" ? "settled" : reply.data.kind,
          responseAmountAgorot: null,
          hoursToRespond: null,
        },
      });
    });

    if (reply.data.kind === "settled") {
      return { caseId, outcome: "settled" as const };
    }

    // ---- wait for the person ----------------------------------------------
    const approval = await step.waitForEvent("mandate-approval", {
      event: mandateApproved,
      timeout: APPROVAL_WINDOW,
      if: `async.data.caseId == "${caseId}"`,
    });

    if (!approval) {
      await step.run("approval-window-closed", () =>
        flagForReview(caseId, `no approval within ${APPROVAL_WINDOW}; the next rung is waiting on the person`),
      );
      return { caseId, outcome: "flagged_no_approval" as const };
    }

    const firstToHandleApproval = await step.run("claim-approval", () =>
      claimResume(caseId, "mandate-approval", approval.data.authorizationId),
    );
    if (!firstToHandleApproval) return { caseId, outcome: "duplicate_approval_ignored" as const };

    // ---- resolve ----------------------------------------------------------
    return { caseId, outcome: "escalation_authorised" as const };
  },
);

export const workflowFunctions = [caseLifecycle];
