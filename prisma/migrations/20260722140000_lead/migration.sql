-- Commissionable lead intake for high-value verticals.

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_vertical_createdAt_idx" ON "Lead"("vertical", "createdAt");
