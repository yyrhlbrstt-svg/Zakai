-- Per-customer Oracle API keys (multi-tenant credentials for /api/oracle/predict).
CREATE TABLE IF NOT EXISTS "OracleKey" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OracleKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "OracleKey_revokedAt_idx" ON "OracleKey"("revokedAt");
