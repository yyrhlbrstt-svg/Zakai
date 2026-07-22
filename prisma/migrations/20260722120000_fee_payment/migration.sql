-- Fee collection fields: which PSP handled it, its reference, and when paid.
ALTER TABLE "Fee" ADD COLUMN "provider" TEXT;
ALTER TABLE "Fee" ADD COLUMN "providerRef" TEXT;
ALTER TABLE "Fee" ADD COLUMN "paidAt" TIMESTAMP(3);
