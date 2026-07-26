-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT 'analyze',
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "webhookUrl" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCaseLink" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "partnerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCaseLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCaseLink_caseId_key" ON "PartnerCaseLink"("caseId");

-- CreateIndex
CREATE INDEX "PartnerCaseLink_partnerId_idx" ON "PartnerCaseLink"("partnerId");

-- AddForeignKey
ALTER TABLE "PartnerCaseLink" ADD CONSTRAINT "PartnerCaseLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCaseLink" ADD CONSTRAINT "PartnerCaseLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
