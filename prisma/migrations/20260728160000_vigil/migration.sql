-- The profile mirrored to the account, so the watchdog runs while its owner is
-- not looking. The device copy stays authoritative and stays the only copy
-- until there is an account.
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One alert per deadline, ever. Re-notifying every morning until a date passes
-- is how a useful alert becomes the reason someone turns notifications off.
CREATE TABLE "VigilAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VigilAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VigilAlert_userId_alertKey_key" ON "VigilAlert"("userId", "alertKey");
CREATE INDEX "VigilAlert_userId_sentAt_idx" ON "VigilAlert"("userId", "sentAt");
ALTER TABLE "VigilAlert" ADD CONSTRAINT "VigilAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
