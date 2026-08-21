import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * The event spine — the one write path into ZakaiEvent.
 *
 * Everything the intelligence layer will ever answer depends on a record of
 * what happened, in order, that nothing later overwrites: how long this
 * institution took to answer last time, which tactic preceded a settlement,
 * whether a practice showed up at one company before it showed up at four
 * others. Current-state tables cannot answer any of it, and none of it can be
 * reconstructed after the fact — which is why this exists now, before the
 * engines that will consume it.
 *
 * Three properties, enforced here rather than hoped for:
 *
 *  - APPEND-ONLY. This module exposes no update and no delete. A correction
 *    is a new event. An edited history is not a history.
 *  - CLOSED EVENT SET. Free-text event types turn a dataset into a landfill
 *    within a year; a name not in EVENT_TYPES is rejected at the type level
 *    and again at runtime.
 *  - FAIL-SOFT. Recording history must never break the thing that made
 *    history. Every write is wrapped: if the spine is unavailable, the case
 *    still proceeds and the failure is reported, not thrown.
 *
 * PRIVACY BOUNDARY, non-negotiable: rows here can reference a case, so they
 * are personal data and stay internal. StrategyOutcome remains the only
 * publishable outcome record and keeps its de-identification rule. Nothing
 * aggregated out of this may reach an institution in a form that identifies
 * the person claiming against them.
 */

export const EVENT_TYPES = [
  /**
   * Zakai told somebody they are owed money, before they asked.
   *
   * Recorded at the moment the claim gate says speak — and only then, because
   * a silenced finding was never shown to anybody and counting it would make
   * the ratio below flatter it. This is the denominator of the one number that
   * catches a drifting detector before a single person complains: of everything
   * we announced, how much became a real case, and how much of that was ever
   * proved in money.
   *
   * Deliberately carries no statement text and no merchant string — only the
   * claim kind, the provider key when there is a registry-backed one, and the
   * confidence that got it past the gate.
   */
  "claim.surfaced",
  "claim.created",
  "mandate.signed",
  "institution.contacted",
  "institution.responded",
  "outcome.recorded",
  "policy.observed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Money stays integer agorot here exactly as everywhere else. */
const agorot = z.number().int().nonnegative();

const PAYLOADS = {
  "claim.surfaced": z.object({
    claimType: z.string().min(1).max(60),
    estimatedValueAgorot: agorot.nullable(),
    /** What the gate measured. Stored so a bad ratio can be read by band. */
    confidence: z.number().min(0).max(1),
    /** Which screen said it, so a single bad surface is separable. */
    surface: z.enum(["money_scan", "leaks", "entitlements", "vertical_tool", "signal"]),
  }),
  "claim.created": z.object({
    claimType: z.string().min(1).max(60),
    estimatedValueAgorot: agorot.nullable(),
    source: z.enum(["self_service", "referral", "partner", "scan", "unknown"]),
  }),
  "mandate.signed": z.object({
    /** The signature itself never lands here — only a digest of it. */
    signatureHash: z.string().min(8).max(128),
    signingMethod: z.string().min(1).max(40),
  }),
  "institution.contacted": z.object({
    channel: z.enum(["email", "api", "portal", "letter"]),
    /** A summary, never the letter body: bodies carry personal detail. */
    messageSummary: z.string().max(300),
  }),
  "institution.responded": z.object({
    responseType: z.enum(["settled", "denied", "countered", "silence"]),
    responseAmountAgorot: agorot.nullable(),
    hoursToRespond: z.number().int().nonnegative().nullable(),
  }),
  "outcome.recorded": z.object({
    finalAmountAgorot: agorot.nullable(),
    finalStatus: z.enum(["won", "lost", "partial", "abandoned"]),
    totalDurationDays: z.number().int().nonnegative().nullable(),
    tacticsUsed: z.array(z.string().min(1).max(40)).max(12),
  }),
  "policy.observed": z.object({
    policyType: z.string().min(1).max(60),
    description: z.string().max(300),
    firstObservedViaCaseId: z.string().max(40).nullable(),
  }),
} as const;

export type EventPayload<T extends EventType> = z.infer<(typeof PAYLOADS)[T]>;

export interface RecordEventInput<T extends EventType> {
  eventType: T;
  payload: EventPayload<T>;
  caseId?: string | null;
  /** Normalised counterparty key — never free text, or grouping dies. */
  institution?: string | null;
  domain?: string | null;
  /** Defaults to now; pass the real time when it differs from ours. */
  occurredAt?: Date;
}

export type RecordEventResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid_payload" | "unknown_event_type" | "write_failed" };

/**
 * Append one event. Never throws: a spine that can take down a claim is worse
 * than no spine, because the claim is the thing that matters and the event is
 * the record of it.
 */
export async function recordEvent<T extends EventType>(
  input: RecordEventInput<T>,
): Promise<RecordEventResult> {
  const schema = PAYLOADS[input.eventType];
  if (!schema) return { ok: false, reason: "unknown_event_type" };

  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) return { ok: false, reason: "invalid_payload" };

  try {
    const row = await prisma.zakaiEvent.create({
      data: {
        eventType: input.eventType,
        caseId: input.caseId ?? null,
        institution: input.institution?.trim() || null,
        domain: input.domain?.trim() || null,
        payload: parsed.data as object,
        occurredAt: input.occurredAt ?? new Date(),
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
}
