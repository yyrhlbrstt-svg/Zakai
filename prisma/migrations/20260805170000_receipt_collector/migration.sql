-- Receipt collector: photo-scanned receipts/invoices, duplicate-charge
-- detection, and interest capture for future Gmail/Outlook auto-scanning.
CREATE TABLE IF NOT EXISTS "Receipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "amountAgorot" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "occurredAt" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "hasVat" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'photo',
    "duplicateOfId" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Receipt_userId_createdAt_idx" ON "Receipt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Receipt_userId_vendor_amountAgorot_idx" ON "Receipt"("userId", "vendor", "amountAgorot");

ALTER TABLE "Receipt"
    ADD CONSTRAINT "Receipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ConnectedInboxInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectedInboxInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedInboxInterest_userId_provider_key" ON "ConnectedInboxInterest"("userId", "provider");

ALTER TABLE "ConnectedInboxInterest"
    ADD CONSTRAINT "ConnectedInboxInterest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
