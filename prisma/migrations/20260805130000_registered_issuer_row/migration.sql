-- Durable trust-registry issuer admissions (parties with their own JWKS/keys).
CREATE TABLE IF NOT EXISTS "RegisteredIssuerRow" (
    "iss" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jwksUri" TEXT NOT NULL,
    "statusListUri" TEXT NOT NULL,
    "allowedScopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RegisteredIssuerRow_pkey" PRIMARY KEY ("iss")
);

CREATE INDEX IF NOT EXISTS "RegisteredIssuerRow_status_idx" ON "RegisteredIssuerRow"("status");
