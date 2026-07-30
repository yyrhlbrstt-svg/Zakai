import "server-only";
import { prisma } from "@/lib/prisma";

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
    select: { code: true, status: true },
  });
  if (!auth) return { ok: false, reason: "not_found" };
  if (auth.status === "REVOKED") return { ok: true, code: auth.code, alreadyRevoked: true };

  await prisma.$transaction(async (tx) => {
    await tx.authorization.update({
      where: { code: auth.code },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    // Publish it. Without this the person's revocation is a row in our database
    // and nothing more — every institution holding a cached status list would
    // go on honouring the mandate, correctly, because we never told them.
    const existing = await tx.mandateRevocation.findUnique({
      where: { jti: auth.code },
      select: { jti: true },
    });
    if (!existing) {
      await tx.mandateRevocation.create({
        data: {
          jti: auth.code,
          statusIndex: await nextStatusIndex(tx),
          reason: "user_request",
        },
      });
    }
  });

  return { ok: true, code: auth.code, alreadyRevoked: false };
}

/**
 * Next free position in the status list.
 *
 * Indices are never reused. Reusing one would silently transfer a revocation
 * from an old mandate to a new one for every institution still holding the
 * older cached list — they would read the bit, see it set, and refuse a
 * perfectly valid credential.
 */
async function nextStatusIndex(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<number> {
  const top = await tx.mandateRevocation.aggregate({ _max: { statusIndex: true } });
  return (top._max.statusIndex ?? -1) + 1;
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
