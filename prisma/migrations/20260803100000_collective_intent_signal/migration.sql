-- Anonymous collective intent signals (no PII).
CREATE TABLE "CollectiveIntentSignal" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectiveIntentSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectiveIntentSignal_market_vertical_idx" ON "CollectiveIntentSignal"("market", "vertical");
CREATE INDEX "CollectiveIntentSignal_createdAt_idx" ON "CollectiveIntentSignal"("createdAt");
