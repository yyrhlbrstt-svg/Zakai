-- Verification depth: how many billing cycles a recurring saving has actually
-- been confirmed for. One is the honest floor and matches every existing row —
-- settling a case verifies the bill in front of us and nothing beyond it.
ALTER TABLE "SavingsProof" ADD COLUMN "confirmedCycles" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SavingsProof" ADD COLUMN "lastConfirmedAt" TIMESTAMP(3);
