-- The record of what a person is committed to, and until when they can leave.
--
-- Everything else in this schema is episodic: a Case exists because somebody
-- suspected they were owed money on a particular day. Obligations are the
-- opposite — everyone has a set, it changes every month whether anyone is
-- paying attention, and today it lives nowhere. The bank app has the charge,
-- the inbox has the contract, and nothing holds the two together.
--
-- monthlyMinor and noticeDays are nullable on purpose: "we do not know yet"
-- has to stay distinguishable from zero, and a guessed notice period produces
-- a confident deadline that is wrong.

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "monthlyMinor" INTEGER,
    "renewsOn" TIMESTAMP(3),
    "noticeDays" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commitment_userId_endedAt_idx" ON "Commitment"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "Commitment_renewsOn_idx" ON "Commitment"("renewsOn");

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

