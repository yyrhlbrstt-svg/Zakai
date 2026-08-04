-- Durable partner embed keys (distribution rail, not ephemeral process memory).
CREATE TABLE IF NOT EXISTS "WidgetKey" (
    "key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "WidgetKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "WidgetKey_domain_idx" ON "WidgetKey"("domain");
CREATE INDEX IF NOT EXISTS "WidgetKey_revokedAt_idx" ON "WidgetKey"("revokedAt");
