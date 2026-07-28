-- Position in the signed status list, so revocation is one bit rather than a
-- row every verifier has to download.
ALTER TABLE "MandateRevocation" ADD COLUMN "statusIndex" INTEGER;
CREATE UNIQUE INDEX "MandateRevocation_statusIndex_key" ON "MandateRevocation"("statusIndex");
