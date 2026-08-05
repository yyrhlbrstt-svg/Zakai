-- Issue-time status-list bit position (schema promised "Assigned at issue time").
ALTER TABLE "Authorization" ADD COLUMN IF NOT EXISTS "mandateStatusIndex" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "Authorization_mandateStatusIndex_key" ON "Authorization"("mandateStatusIndex");

CREATE TABLE IF NOT EXISTS "MandateStatusAllocation" (
    "statusIndex" INTEGER NOT NULL,
    "jti" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MandateStatusAllocation_pkey" PRIMARY KEY ("statusIndex")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MandateStatusAllocation_jti_key" ON "MandateStatusAllocation"("jti");
