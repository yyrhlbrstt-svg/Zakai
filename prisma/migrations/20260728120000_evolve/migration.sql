-- The self-improvement engine's ledger. PII-free by construction.
CREATE TABLE "ExperimentTrial" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "armId" TEXT NOT NULL,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "guardrails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentTrial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExperimentTrial_experimentId_armId_idx" ON "ExperimentTrial"("experimentId", "armId");
CREATE INDEX "ExperimentTrial_experimentId_createdAt_idx" ON "ExperimentTrial"("experimentId", "createdAt");

-- Append-only: a change the machine made to the product must outlive the next one.
CREATE TABLE "ExperimentPromotion" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "armId" TEXT NOT NULL,
    "relativeLift" DOUBLE PRECISION NOT NULL,
    "samples" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "revertedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentPromotion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExperimentPromotion_experimentId_promotedAt_idx" ON "ExperimentPromotion"("experimentId", "promotedAt");
