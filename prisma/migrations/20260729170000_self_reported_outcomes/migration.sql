-- Outcomes could only be recorded by the full case pipeline, which needs an
-- account, ownership verification and an authorization. Every letter the
-- entitlement, captive, incident and dormant paths produce went out and taught
-- us nothing — so the one asset that compounds was gated behind the heaviest
-- flow in the product.
--
-- A self-report is real evidence and it is not the same evidence: a verified
-- case has a provider reply and a documented saving behind it; a self-report
-- has somebody's memory. The column exists so every reader has to decide which
-- it wants, rather than silently averaging the two.
ALTER TABLE "StrategyOutcome" ADD COLUMN "selfReported" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "StrategyOutcome_selfReported_createdAt_idx" ON "StrategyOutcome"("selfReported", "createdAt");
