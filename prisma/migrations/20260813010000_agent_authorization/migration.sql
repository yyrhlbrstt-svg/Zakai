-- A third-party agent that asks OUR users for authority. Deliberately distinct
-- from DelegatedIssuer, which issues for its own users and carries onBehalfOf.
CREATE TABLE "AgentClient" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "redirectUris" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contact" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentClient_slug_key" ON "AgentClient"("slug");
CREATE INDEX "AgentClient_status_idx" ON "AgentClient"("status");

-- One human decision, in flight.
CREATE TABLE "AgentAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "purpose" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '',
    "grantSeconds" INTEGER NOT NULL DEFAULT 2592000,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "codeHash" TEXT,
    "mandateJws" TEXT,
    "mandateJti" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentAuthorizationRequest_codeHash_key" ON "AgentAuthorizationRequest"("codeHash");
CREATE INDEX "AgentAuthorizationRequest_clientId_createdAt_idx" ON "AgentAuthorizationRequest"("clientId", "createdAt");
CREATE INDEX "AgentAuthorizationRequest_status_expiresAt_idx" ON "AgentAuthorizationRequest"("status", "expiresAt");

ALTER TABLE "AgentAuthorizationRequest" ADD CONSTRAINT "AgentAuthorizationRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "AgentClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
