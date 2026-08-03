-- Persist mandate jti on human authorization for provider intake + revocation checks.
ALTER TABLE "Authorization" ADD COLUMN IF NOT EXISTS "mandateJti" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Authorization_mandateJti_key" ON "Authorization"("mandateJti");
