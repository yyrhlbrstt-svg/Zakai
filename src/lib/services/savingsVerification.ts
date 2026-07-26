import "server-only";
import { prisma } from "@/lib/prisma";

export type MailConnectionProvider = "gmail" | "microsoft";

interface MailConnectionInput {
  userId: string;
  provider: MailConnectionProvider;
  /** OAuth refresh token. Encrypted at rest in a real deployment. */
  refreshToken: string;
  /** Optional access token for immediate use. */
  accessToken?: string;
  /** When the access token expires. */
  expiresAt?: Date;
  /** Scopes that were granted. */
  scope: string;
}

/**
 * Store a user's consent to read their mailbox for savings verification.
 * This is the trust scaffolding for automatic proof-of-savings; the actual
 * IMAP/Gmail API reading is a later integration step (requires OAuth app).
 */
export async function connectMailForSavingsProof(input: MailConnectionInput) {
  return prisma.mailConnection.upsert({
    where: { userId_provider: { userId: input.userId, provider: input.provider } },
    update: {
      refreshToken: input.refreshToken,
      accessToken: input.accessToken,
      expiresAt: input.expiresAt,
      scope: input.scope,
      status: "ACTIVE",
      updatedAt: new Date(),
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      refreshToken: input.refreshToken,
      accessToken: input.accessToken,
      expiresAt: input.expiresAt,
      scope: input.scope,
      status: "ACTIVE",
    },
  });
}

/**
 * Revoke mail access. The record is kept for audit; status changes to REVOKED.
 */
export async function revokeMailForSavingsProof(userId: string, provider: MailConnectionProvider) {
  return prisma.mailConnection.updateMany({
    where: { userId, provider, status: "ACTIVE" },
    data: { status: "REVOKED", updatedAt: new Date() },
  });
}
