-- Idempotency stamp for the learning signal (StrategyOutcome write).
-- Outcome rows stay de-identified (no Case FK); this flag lives on Case only.
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "outcomeRecordedAt" TIMESTAMP(3);
