-- Hold a promised credit as a promise, not as a saving.
--
-- A provider agreeing on a call is not money. Before this, a case that
-- reached "they said yes" had two possible endings and both were wrong:
-- settle it — writing a SavingsProof and a chargeable Fee for money that has
-- not moved — or leave it, and let the promise be forgotten. The most
-- reliable way to not pay somebody is to promise to pay them and let it
-- drift; each instance is too small to chase from memory.
--
-- observedMinor is nullable on purpose: zero is a real answer ("we checked,
-- nothing came") and has to stay distinguishable from "nobody has checked".

-- CreateTable
CREATE TABLE "PromisedCreditRecord" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "promisedMinor" INTEGER NOT NULL,
    "promisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueBy" TIMESTAMP(3),
    "observedMinor" INTEGER,
    "checkedAt" TIMESTAMP(3),
    "evidenceNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromisedCreditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromisedCreditRecord_caseId_key" ON "PromisedCreditRecord"("caseId");

-- CreateIndex
CREATE INDEX "PromisedCreditRecord_counterparty_checkedAt_idx" ON "PromisedCreditRecord"("counterparty", "checkedAt");

-- CreateIndex
CREATE INDEX "PromisedCreditRecord_dueBy_idx" ON "PromisedCreditRecord"("dueBy");

-- AddForeignKey
ALTER TABLE "PromisedCreditRecord" ADD CONSTRAINT "PromisedCreditRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

