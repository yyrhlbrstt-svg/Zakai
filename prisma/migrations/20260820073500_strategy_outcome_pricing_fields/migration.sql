-- AlterTable
ALTER TABLE "StrategyOutcome" ADD COLUMN     "claimBasisMinor" INTEGER,
ADD COLUMN     "escalationStage" TEXT,
ADD COLUMN     "rightId" TEXT;

-- CreateIndex
CREATE INDEX "StrategyOutcome_rightId_idx" ON "StrategyOutcome"("rightId");
