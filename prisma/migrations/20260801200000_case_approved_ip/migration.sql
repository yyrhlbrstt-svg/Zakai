-- Records the requesting IP at the moment of consent, alongside the existing
-- approvedAt timestamp — a timestamp alone proves *when* consent was logged,
-- not *that* the account holder gave it. Nullable and additive: existing
-- cases keep approvedIp = NULL, nothing else changes.
ALTER TABLE "Case" ADD COLUMN "approvedIp" TEXT;
