-- Bind success fees to the machine Mandate that authorized the outreach.
ALTER TABLE "Fee" ADD COLUMN IF NOT EXISTS "mandateJti" TEXT;
CREATE INDEX IF NOT EXISTS "Fee_mandateJti_idx" ON "Fee"("mandateJti");
