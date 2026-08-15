-- Mark which outcomes are backed by a signed settlement.
--
-- The outcome graph has learned from rows: our own assertion that a case
-- ended a certain way. A settlement-backed row is a different grade of
-- evidence — anyone can verify it against the published JWKS, and no party
-- including us can rewrite it afterwards.
--
-- Defaults false rather than backfilling. Existing rows were never held to
-- that standard, and promoting them would make the corpus claim a rigour it
-- does not have — which is exactly the kind of quiet inflation that makes a
-- dataset worthless to the people who most need to trust it.
ALTER TABLE "StrategyOutcome" ADD COLUMN "settlementBacked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "StrategyOutcome_settlementBacked_idx"
  ON "StrategyOutcome"("settlementBacked");
