-- Per-customer keys for the licensed systemic-pattern evidence API.
CREATE TABLE IF NOT EXISTS "EvidenceKey" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EvidenceKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "EvidenceKey_revokedAt_idx" ON "EvidenceKey"("revokedAt");
