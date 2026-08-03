-- Persist compact Mandate JWS so outbound email can attach structured inbound JSON.
ALTER TABLE "Authorization" ADD COLUMN IF NOT EXISTS "mandateJws" TEXT;
