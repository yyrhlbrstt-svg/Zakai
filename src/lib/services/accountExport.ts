import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Everything Zakai holds about one person, in a file they can take away.
 *
 * The right to delete was already implemented; the right to a copy was not,
 * and they are two different rights (Privacy Protection Law Amendment 13; the
 * same split exists in GDPR Arts. 15 and 17). "You can delete it" is not an
 * answer to "show me what you have".
 *
 * WHAT IS DELIBERATELY EXCLUDED, AND WHY
 *
 * `passwordHash` and the hashed one-time codes never appear. A hash in an
 * exported file is a hash in a downloads folder, in an email attachment, on a
 * shared laptop — and it is not information about the person in any sense they
 * would recognise. Session tokens are excluded for the same reason.
 *
 * `StrategyOutcome` is excluded because it genuinely does not belong to any
 * one person: it is de-identified by design and carries no user or case key,
 * so there is nothing here to return without breaking that.
 *
 * WHAT IS DELIBERATELY INCLUDED
 *
 * The full letter bodies from the Outbox. They are the part somebody would
 * actually need — to show a regulator what was sent in their name, or to
 * continue a claim somewhere else — and withholding them while exporting the
 * metadata around them would make the export a gesture rather than a copy.
 */
export interface AccountExport {
  exportedAt: string;
  format: "zakai-account-export/1";
  notes: string[];
  account: Record<string, unknown>;
  cases: unknown[];
  authorizations: unknown[];
  outbox: unknown[];
  savingsProofs: unknown[];
  fees: unknown[];
  consents: unknown[];
  commitments: unknown[];
  coupons: unknown[];
  deadlines: unknown[];
  feedbackFromThisAccount: unknown[];
}

export async function buildAccountExport(userId: string): Promise<AccountExport | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      plan: true,
      createdAt: true,
      emailVerifiedAt: true,
      referralCode: true,
      referralCreditAgorot: true,
    },
  });
  if (!user) return null;

  const [cases, consents, commitments, coupons, deadlines, feedback] = await Promise.all([
    prisma.case.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        authorization: {
          select: {
            code: true,
            provider: true,
            scope: true,
            status: true,
            issuedAt: true,
            revokedAt: true,
            mandateJti: true,
          },
        },
        savingsProof: true,
        fee: true,
        outbox: {
          select: {
            id: true,
            channel: true,
            toAddress: true,
            subject: true,
            body: true,
            status: true,
            error: true,
            createdAt: true,
            sentAt: true,
          },
        },
      },
    }),
    prisma.consent.findMany({ where: { userId }, orderBy: { grantedAt: "desc" } }),
    prisma.commitment.findMany({ where: { userId } }).catch(() => []),
    prisma.coupon.findMany({ where: { userId } }).catch(() => []),
    prisma.deadline.findMany({ where: { userId } }).catch(() => []),
    // Feedback is stored without a user FK, so it is matched by the address on
    // the account. An empty list here means "none we can attribute", which is
    // not the same as "none was sent" — said out loud in `notes` rather than
    // left for somebody to assume.
    prisma.feedback.findMany({ where: { email: user.email } }).catch(() => []),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "zakai-account-export/1",
    notes: [
      "Amounts are in minor units (agorot). 540 means ₪5.40.",
      "Password hashes, one-time codes and session tokens are deliberately excluded — they are credentials, not personal information.",
      "De-identified outcome statistics carry no link to any account and therefore cannot appear in a per-account export.",
      "Feedback is matched by the email address on this account; messages sent from another address are not listed.",
    ],
    account: user as unknown as Record<string, unknown>,
    cases: cases.map(({ authorization, savingsProof, fee, outbox, ...rest }) => rest),
    authorizations: cases.map((c) => c.authorization).filter(Boolean),
    outbox: cases.flatMap((c) => c.outbox.map((o) => ({ ...o, caseId: c.id }))),
    savingsProofs: cases.map((c) => c.savingsProof).filter(Boolean),
    fees: cases.map((c) => c.fee).filter(Boolean),
    consents,
    commitments,
    coupons,
    deadlines,
    feedbackFromThisAccount: feedback,
  };
}
