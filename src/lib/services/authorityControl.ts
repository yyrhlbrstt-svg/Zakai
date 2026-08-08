import "server-only";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";
import {
  publishRevocation,
  StatusIndexUnknownError,
  StatusListCapacityError,
} from "@/lib/mandate/statusIndex";

/**
 * The consumer's control plane over their own authority.
 *
 * WHAT WAS MISSING
 *
 * A person could grant Zakai authority to act for them and then had no way to
 * see what they had granted, or to take it back. Every other side of this
 * protocol was built — institutions can verify offline, other issuers can join
 * the registry, the mandate is a standard JWT — and the side it all exists to
 * serve had no screen at all.
 *
 * That is not only a product gap. Revocability is what makes an authorisation
 * lawful consent rather than a signature someone obtained once: a permission
 * that cannot be withdrawn is not a permission, it is a transfer. Any
 * regulator looking at agentic authority will ask this question first, and
 * "the user emails support" is not an answer that survives it.
 *
 * WHY IT MATTERS BEYOND COMPLIANCE
 *
 * This is the side of the network that makes the other three work. A person
 * will only let an agent act for them if withdrawing that permission is one
 * tap and takes effect everywhere. Once that is true, they start demanding it
 * — and an agent that cannot present a revocable, verifiable mandate starts
 * losing to one that can. The control plane is what turns the protocol from
 * something institutions tolerate into something consumers ask for by name.
 *
 * THE LINE THAT CLOSES THE LOOP
 *
 * A revocation here assigns a status-list index and writes it, which means the
 * next signed list every institution on Earth fetches carries the flipped bit.
 * One tap on a phone in Haifa, honoured by a bank in Frankfurt that never
 * called us — that is the whole design, and until this file existed there was
 * no way for a person to trigger it.
 */

export interface GrantedAuthority {
  /** The public, human-verifiable code on the document. */
  code: string;
  /** Who it authorises action against. */
  provider: string;
  /** Exactly what was authorised, in the words the person agreed to. */
  scope: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  issuedAt: Date;
  revokedAt: Date | null;
  /** The case it belongs to, so the UI can link to what it is doing. */
  caseId: string;
}

/**
 * Everything this person has ever authorised, newest first.
 *
 * Revoked grants stay in the list rather than disappearing. A control plane
 * that hides what was withdrawn cannot answer "did I actually revoke that",
 * which is the question people open it to ask.
 */
export async function listAuthorities(userId: string): Promise<GrantedAuthority[]> {
  const rows = await prisma.authorization.findMany({
    where: { case: { userId } },
    orderBy: { issuedAt: "desc" },
    select: {
      code: true,
      provider: true,
      scope: true,
      status: true,
      issuedAt: true,
      revokedAt: true,
      caseId: true,
    },
    take: 200,
  });
  return rows as GrantedAuthority[];
}

export type RevokeResult =
  | { ok: true; code: string; alreadyRevoked: boolean }
  | { ok: false; reason: "not_found" };

/**
 * Withdraw an authority.
 *
 * Idempotent, and deliberately so: someone who taps twice because the first tap
 * did not visibly do anything must not get an error implying it failed. The
 * only outcomes are "it is revoked" and "that was not yours".
 *
 * Ownership is enforced through the case relation rather than trusted from the
 * caller. A revoke endpoint that took a code and acted on it would let anyone
 * with a code — which appears on documents sent to third parties — cancel a
 * stranger's authority.
 */
export async function revokeAuthority(userId: string, code: string): Promise<RevokeResult> {
  const normalised = code.trim().toUpperCase();
  const auth = await prisma.authorization.findFirst({
    where: { code: normalised, case: { userId } },
    select: {
      code: true,
      status: true,
      mandateJti: true,
      mandateStatusIndex: true,
      caseId: true,
    },
  });
  if (!auth) return { ok: false, reason: "not_found" };

  // Already-revoked rows still need a heal path: pre-fix revokes published
  // under the human ZK code, leaving the JWT jti active. Re-tap / revokeAll
  // must publish under mandateJti (idempotent if already indexed).
  if (auth.status === "REVOKED") {
    if (auth.mandateJti) {
      try {
        await prisma.$transaction((tx) =>
          publishRevocation(tx, {
            jti: auth.mandateJti!,
            reason: "user_request",
            statusIndex: auth.mandateStatusIndex ?? undefined,
          }),
        );
      } catch {
        /* status store down — human revoke already stands */
      }
    }
    return { ok: true, code: auth.code, alreadyRevoked: true };
  }

  // Human revoke must not roll back if the status-list publish cannot resolve
  // an issue-time bit — offline verifiers stay honest via fail-closed unknown,
  // while the consumer's Authorization is still withdrawn.
  await prisma.authorization.update({
    where: { code: auth.code },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  // Close the consumer loop: a pre-settle case under withdrawn authority must
  // not stay SENT (recordSaving would otherwise still mint a fee).
  await prisma.case.updateMany({
    where: {
      id: auth.caseId,
      status: { in: ["ANALYZED", "APPROVED", "VERIFIED", "SENT"] },
    },
    data: { status: "REVOKED" },
  });

  if (auth.mandateJti) {
    try {
      await prisma.$transaction((tx) =>
        publishRevocation(tx, {
          jti: auth.mandateJti!,
          reason: "user_request",
          statusIndex: auth.mandateStatusIndex ?? undefined,
        }),
      );
    } catch (err) {
      /**
       * The human revoke already stands, so this never rolls back — but it
       * must never be silent either.
       *
       * If the status-list bit is not published, every institution verifying
       * the machine Mandate still sees it as valid, while the person has been
       * told they revoked. That is the exact gap between a control that works
       * in a demo and one that works when it is actually needed, and it used
       * to be swallowed by an `if` with an empty body — which discarded every
       * failure including a status store that was simply down.
       *
       * The two typed errors are reported at least as loudly as an unknown
       * one: they mean the status list cannot express this revocation at all,
       * which does not resolve on a retry.
       */
      await reportError(err, {
        at: "revokeAuthority.publishRevocation",
        jti: auth.mandateJti,
        statusIndex: auth.mandateStatusIndex,
        // Named so an alert says which failure this is without a stack dive.
        kind:
          err instanceof StatusIndexUnknownError
            ? "status_index_unknown"
            : err instanceof StatusListCapacityError
              ? "status_list_capacity"
              : "status_store_unavailable",
        consumerRevokeStands: true,
      });
    }
  }

  return { ok: true, code: auth.code, alreadyRevoked: false };
}

/** How many authorities are live right now — for the header badge. */
export async function countActiveAuthorities(userId: string): Promise<number> {
  return prisma.authorization.count({
    where: { case: { userId }, status: "ACTIVE" },
  });
}

/**
 * Withdraw every active authority this person holds, in one action.
 *
 * WHY THIS EXISTS SEPARATELY FROM `revokeAuthority`
 *
 * A stolen phone or a compromised account is the moment someone needs "off,"
 * not "off, one at a time" — going through N authorities individually, in a
 * panic, is exactly the gap between a control that works in a demo and one
 * that works when it is actually needed. `revokeAuthority` already does the
 * one thing that matters (flip the status-list bit every institution on
 * Earth reads), so this is that same function run over every active code,
 * not a second way of revoking.
 *
 * Deliberately not atomic across authorities: if the tenth of forty
 * revocations fails, the first nine having already taken effect is the
 * correct outcome — a person mid-emergency should not lose the eight
 * revocations that already succeeded because a ninth hit a transient error.
 */
export async function revokeAllAuthorities(
  userId: string,
): Promise<{ revoked: string[]; failed: string[] }> {
  const active = await prisma.authorization.findMany({
    where: { case: { userId }, status: "ACTIVE" },
    select: { code: true },
  });

  const revoked: string[] = [];
  const failed: string[] = [];
  for (const { code } of active) {
    const result = await revokeAuthority(userId, code);
    if (result.ok) revoked.push(result.code);
    else failed.push(code);
  }
  return { revoked, failed };
}
