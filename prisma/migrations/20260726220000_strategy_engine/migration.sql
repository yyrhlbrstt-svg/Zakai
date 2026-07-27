-- Strategy Engine: attribute each case to the stance it was filed with, and
-- accumulate a PII-free evidence base of what actually got paid.

ALTER TABLE "Case" ADD COLUMN "strategyVariant" TEXT;
ALTER TABLE "Case" ADD COLUMN "strategySeed" INTEGER;

CREATE TABLE "StrategyOutcome" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "recoveredMinor" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyOutcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StrategyOutcome_market_vertical_counterparty_idx" ON "StrategyOutcome"("market", "vertical", "counterparty");
CREATE INDEX "StrategyOutcome_market_vertical_idx" ON "StrategyOutcome"("market", "vertical");
