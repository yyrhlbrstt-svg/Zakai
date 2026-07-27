-- MandateRevocation: institutional recency check for Ed25519 Mandates.
-- Apply on Neon if `prisma migrate` is not run from CI.

CREATE TABLE IF NOT EXISTS "MandateRevocation" (
    "jti" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL DEFAULT 'user_request',
    "internalNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MandateRevocation_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX IF NOT EXISTS "MandateRevocation_revokedAt_idx" ON "MandateRevocation"("revokedAt");
