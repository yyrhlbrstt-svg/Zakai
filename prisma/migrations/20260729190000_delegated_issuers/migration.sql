-- Issuance was gated by a single shared secret, ours. A third-party agent could
-- not obtain a mandate for its own user even if it wanted to, which made the
-- "become the rail everyone runs on" thesis unreachable by construction: the
-- rail had exactly one train and no way to add another.
--
-- Only the hash of the key is stored. A leaked table must not hand somebody the
-- ability to issue authority in other people's names.
CREATE TABLE "DelegatedIssuer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "allowedScopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "DelegatedIssuer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DelegatedIssuer_slug_key" ON "DelegatedIssuer"("slug");
CREATE UNIQUE INDEX "DelegatedIssuer_keyHash_key" ON "DelegatedIssuer"("keyHash");
CREATE INDEX "DelegatedIssuer_status_idx" ON "DelegatedIssuer"("status");
