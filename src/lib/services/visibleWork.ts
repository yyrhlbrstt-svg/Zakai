import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Visible Work — one surface for everything ever done in a person's name.
 *
 * WHAT WAS MISSING
 *
 * Every fact needed for this already existed and none of it was ever shown
 * together. `/authority` lists permissions but not what was done with them.
 * A case page shows one case's next step but not the history. The Outbox is
 * a table nobody outside the code has ever seen. So the one question a person
 * actually has — "what has this thing done for me, under what permission, and
 * can I stop it" — had no screen that answered it.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 * An action is reported at the strength it actually reached, never higher.
 * A letter that was written but has not left is `letter_queued`, not
 * `letter_delivered` — and today, with no SMTP host configured in production,
 * that is *every* letter. A ledger that called those "sent" would be lying in
 * exactly the way this codebase forbids (an agent must never claim it filed
 * something when it only drafted text). The queued count on this page is
 * therefore a real, visible measure of a real, unfixed gap, and it is supposed
 * to be uncomfortable until SMTP is configured.
 *
 * WHY THE AUTHORITY COLUMN IS THE POINT
 *
 * Any product can show a list of things it did. What cannot be retrofitted is
 * binding each action to the specific signed, revocable authority it was taken
 * under — including actions taken under an authority that has since been
 * withdrawn, which stay on the page rather than disappearing. Withdrawn
 * permission does not un-happen the letter, and a ledger that quietly dropped
 * those rows would be worth less than no ledger at all.
 */

export type WorkEventKind =
  /** A claim was opened. Nothing has left Zakai at this point. */
  | "case_opened"
  /** The person explicitly approved acting on their behalf. */
  | "consent_given"
  /** Ownership of the account/line was proven. */
  | "ownership_verified"
  /** A signed, scoped, revocable authority was issued. */
  | "authority_granted"
  /** An authority was withdrawn — by the person, or by us. */
  | "authority_revoked"
  /** A letter exists and is addressed, and has NOT left yet. */
  | "letter_queued"
  /** A letter actually left Zakai and reached the counterparty's address. */
  | "letter_delivered"
  /** Delivery was attempted and failed. */
  | "letter_failed"
  /** A before/after saving was documented. */
  | "saving_documented"
  /** A success fee was raised against a documented saving. */
  | "fee_raised"
  /** A fee was actually collected. */
  | "fee_paid"
  /** Account-level terms consent. */
  | "terms_accepted";

/** Did this action leave Zakai, or did it only happen inside it? */
export type WorkReach = "internal" | "outward";

export interface WorkEvent {
  /** Stable per-row id so React keys and de-duplication are not positional. */
  id: string;
  at: Date;
  kind: WorkEventKind;
  reach: WorkReach;
  /** Who it was directed at, when it was directed at anyone outside. */
  counterparty: string | null;
  caseId: string | null;
  /** The human-verifiable authority code this action was taken under. */
  authorityCode: string | null;
  /** True when that authority has since been withdrawn. */
  authorityRevoked: boolean;
  /** Minor units (agorot) where the event is about money; never a float. */
  amountMinor: number | null;
  /** Delivery failure text, for `letter_failed` only. */
  failure: string | null;
}

export interface VisibleWorkLedger {
  events: WorkEvent[];
  /** Total actions recorded. */
  total: number;
  /** How many actually left Zakai and reached someone else. */
  delivered: number;
  /** Written and addressed, but still sitting here. */
  waiting: number;
  /** Attempted and failed. */
  failed: number;
  /** Authorities live right now. */
  activeAuthorities: number;
  /** Actions taken under an authority that has since been withdrawn. */
  underRevokedAuthority: number;
}

/** Newest first; ties broken by kind so a render is stable across reloads. */
function byNewest(a: WorkEvent, b: WorkEvent): number {
  const d = b.at.getTime() - a.at.getTime();
  return d !== 0 ? d : a.kind.localeCompare(b.kind);
}

/**
 * Everything done in this person's name, newest first.
 *
 * Scoped through the `Case.userId` relation on every query rather than trusted
 * from a caller-supplied id anywhere downstream — this page shows counterparty
 * addresses and authority codes, so a scoping mistake here is a data leak, not
 * a display bug.
 */
export async function loadVisibleWork(userId: string, limit = 300): Promise<VisibleWorkLedger> {
  const [cases, authorities, outbox, proofs, fees, consents] = await Promise.all([
    prisma.case.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        createdAt: true,
        approvedAt: true,
        ownershipVerifiedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.authorization.findMany({
      where: { case: { userId } },
      select: {
        code: true,
        provider: true,
        status: true,
        issuedAt: true,
        revokedAt: true,
        caseId: true,
      },
      take: limit,
    }),
    prisma.outbox.findMany({
      where: { case: { userId } },
      select: {
        id: true,
        caseId: true,
        toAddress: true,
        status: true,
        error: true,
        createdAt: true,
        sentAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.savingsProof.findMany({
      where: { case: { userId } },
      select: { id: true, caseId: true, savingMonthly: true, recordedAt: true },
      take: limit,
    }),
    prisma.fee.findMany({
      where: { case: { userId } },
      select: { id: true, caseId: true, amount: true, createdAt: true, paidAt: true },
      take: limit,
    }),
    prisma.consent.findMany({
      where: { userId },
      select: { id: true, grantedAt: true },
      take: 20,
    }),
  ]);

  // Which authority each case was acted under, and whether it still stands.
  const authorityByCase = new Map<string, { code: string; revoked: boolean }>();
  for (const a of authorities) {
    authorityByCase.set(a.caseId, { code: a.code, revoked: a.status === "REVOKED" });
  }
  const providerByCase = new Map(cases.map((c) => [c.id, c.provider]));

  const under = (caseId: string | null) => {
    const a = caseId ? authorityByCase.get(caseId) : undefined;
    return { authorityCode: a?.code ?? null, authorityRevoked: a?.revoked ?? false };
  };

  const events: WorkEvent[] = [];

  for (const c of cases) {
    events.push({
      id: `case:${c.id}`,
      at: c.createdAt,
      kind: "case_opened",
      reach: "internal",
      counterparty: c.provider,
      caseId: c.id,
      ...under(c.id),
      amountMinor: null,
      failure: null,
    });
    if (c.approvedAt) {
      events.push({
        id: `approve:${c.id}`,
        at: c.approvedAt,
        kind: "consent_given",
        reach: "internal",
        counterparty: c.provider,
        caseId: c.id,
        ...under(c.id),
        amountMinor: null,
        failure: null,
      });
    }
    if (c.ownershipVerifiedAt) {
      events.push({
        id: `own:${c.id}`,
        at: c.ownershipVerifiedAt,
        kind: "ownership_verified",
        reach: "internal",
        counterparty: c.provider,
        caseId: c.id,
        ...under(c.id),
        amountMinor: null,
        failure: null,
      });
    }
  }

  for (const a of authorities) {
    events.push({
      id: `auth:${a.code}`,
      at: a.issuedAt,
      kind: "authority_granted",
      reach: "internal",
      counterparty: a.provider,
      caseId: a.caseId,
      authorityCode: a.code,
      authorityRevoked: a.status === "REVOKED",
      amountMinor: null,
      failure: null,
    });
    if (a.revokedAt) {
      events.push({
        id: `revoke:${a.code}`,
        at: a.revokedAt,
        kind: "authority_revoked",
        reach: "internal",
        counterparty: a.provider,
        caseId: a.caseId,
        authorityCode: a.code,
        authorityRevoked: true,
        amountMinor: null,
        failure: null,
      });
    }
  }

  for (const o of outbox) {
    // One row, one line, reported at the strength it actually reached — and
    // timestamped only where there is a real column to timestamp it from.
    // A FAILED row has no `failedAt`, so it is dated by when it was written,
    // which is the last moment about it we can actually prove.
    const kind: WorkEventKind =
      o.status === "SENT" ? "letter_delivered" : o.status === "FAILED" ? "letter_failed" : "letter_queued";
    events.push({
      id: `out:${o.id}`,
      at: (o.status === "SENT" ? o.sentAt : null) ?? o.createdAt,
      kind,
      // Only a delivered letter left. Queued and failed did not, and saying
      // otherwise is the exact claim this codebase forbids.
      reach: o.status === "SENT" ? "outward" : "internal",
      counterparty: (o.caseId ? providerByCase.get(o.caseId) : null) ?? o.toAddress,
      caseId: o.caseId,
      ...under(o.caseId),
      amountMinor: null,
      failure: o.status === "FAILED" ? (o.error ?? "") : null,
    });
  }

  for (const p of proofs) {
    events.push({
      id: `proof:${p.id}`,
      at: p.recordedAt,
      kind: "saving_documented",
      reach: "internal",
      counterparty: providerByCase.get(p.caseId) ?? null,
      caseId: p.caseId,
      ...under(p.caseId),
      amountMinor: p.savingMonthly,
      failure: null,
    });
  }

  for (const f of fees) {
    events.push({
      id: `fee:${f.id}`,
      at: f.createdAt,
      kind: "fee_raised",
      reach: "internal",
      counterparty: providerByCase.get(f.caseId) ?? null,
      caseId: f.caseId,
      ...under(f.caseId),
      amountMinor: f.amount,
      failure: null,
    });
    if (f.paidAt) {
      events.push({
        id: `feepaid:${f.id}`,
        at: f.paidAt,
        kind: "fee_paid",
        reach: "internal",
        counterparty: providerByCase.get(f.caseId) ?? null,
        caseId: f.caseId,
        ...under(f.caseId),
        amountMinor: f.amount,
        failure: null,
      });
    }
  }

  for (const c of consents) {
    events.push({
      id: `consent:${c.id}`,
      at: c.grantedAt,
      kind: "terms_accepted",
      reach: "internal",
      counterparty: null,
      caseId: null,
      authorityCode: null,
      authorityRevoked: false,
      amountMinor: null,
      failure: null,
    });
  }

  events.sort(byNewest);

  return {
    events: events.slice(0, limit),
    total: events.length,
    delivered: events.filter((e) => e.kind === "letter_delivered").length,
    waiting: events.filter((e) => e.kind === "letter_queued").length,
    failed: events.filter((e) => e.kind === "letter_failed").length,
    activeAuthorities: authorities.filter((a) => a.status !== "REVOKED").length,
    underRevokedAuthority: events.filter((e) => e.authorityRevoked && e.kind !== "authority_granted" && e.kind !== "authority_revoked").length,
  };
}
