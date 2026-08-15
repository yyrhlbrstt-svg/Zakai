-- Record which model actually wrote each draft, so the outcome graph can say
-- whether a model change was worth it. Today that question is unanswerable:
-- StrategyOutcome knows the negotiation stance but not the drafter, so swapping
-- ANTHROPIC_MODEL produces no measurable before/after.
--
-- Both columns default to "no attribution" rather than to a model name. Every
-- case that already exists was drafted before this column, and backfilling it
-- with whatever model is configured now would invent a track record for that
-- model out of work it never did.

-- Nullable on Case, mirroring strategyVariant: null means "drafted before
-- attribution existed", which must stay distinguishable from a real value.
ALTER TABLE "Case" ADD COLUMN "drafterId" TEXT;

-- NOT NULL with an explicit sentinel on StrategyOutcome, because every row in
-- this table is an aggregate input: a NULL here would be silently skipped by
-- some readers and counted by others. "unknown" is counted, and reported as
-- unattributed, by all of them.
ALTER TABLE "StrategyOutcome" ADD COLUMN "drafterId" TEXT NOT NULL DEFAULT 'unknown';

-- The scoreboard groups by drafter and splits observed from self-reported
-- outcomes, which is exactly this pair.
CREATE INDEX "StrategyOutcome_drafterId_selfReported_idx"
  ON "StrategyOutcome"("drafterId", "selfReported");
