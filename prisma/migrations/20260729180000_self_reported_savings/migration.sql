-- Six money categories generate letters and none of them could produce a
-- SavingsProof: the proof is one-to-one with a Case, and only the telecom case
-- pipeline creates one. So the loop the whole thesis rests on — act, prove,
-- share — was unreachable from most of the product, and the proof wall would
-- have stayed empty however well the new categories worked.
--
-- A self-reported win now closes that loop. It counts toward the person's
-- record and the public wall, and it never produces a chargeable fee:
-- eighteen percent of a number somebody typed is not a fee this company could
-- defend if asked to.
ALTER TABLE "SavingsProof" ADD COLUMN "selfReported" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "SavingsProof_selfReported_recordedAt_idx" ON "SavingsProof"("selfReported", "recordedAt");
