-- Becoming a delegated issuer required finding a human and emailing them —
-- exactly the "push" failure this protocol exists to avoid. This table is the
-- self-serve front door: a third party proposes a slug and scopes, submits,
-- and a human reviews before a real key is minted. Admission to a trust
-- boundary should never be fully automatic, but locating the human to ask
-- should never be the applicant's problem either.
CREATE TABLE "DelegationApplication" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "requestedScopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DelegationApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DelegationApplication_status_createdAt_idx" ON "DelegationApplication"("status", "createdAt");
