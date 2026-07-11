-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ANALYZED', 'APPROVED', 'VERIFIED', 'SENT', 'SAVED', 'NO_SAVING', 'REVOKED');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "OutboxChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'WAIVED', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "planDescription" TEXT NOT NULL DEFAULT '',
    "amountOriginal" INTEGER NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "marketLow" INTEGER,
    "marketHigh" INTEGER,
    "strategy" TEXT NOT NULL DEFAULT '',
    "draftMessage" TEXT NOT NULL DEFAULT '',
    "status" "CaseStatus" NOT NULL DEFAULT 'ANALYZED',
    "approvedAt" TIMESTAMP(3),
    "ownershipVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authorization" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "principalName" TEXT NOT NULL,
    "principalPhone" TEXT NOT NULL,
    "principalEmail" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "channel" "OutboxChannel" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsProof" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "newAmount" INTEGER NOT NULL,
    "savingMonthly" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "savingMonthly" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL DEFAULT 1800,
    "amount" INTEGER NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Case_userId_idx" ON "Case"("userId");

-- CreateIndex
CREATE INDEX "PhoneVerification_userId_idx" ON "PhoneVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Authorization_caseId_key" ON "Authorization"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Authorization_code_key" ON "Authorization"("code");

-- CreateIndex
CREATE INDEX "Outbox_caseId_idx" ON "Outbox"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsProof_caseId_key" ON "SavingsProof"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Fee_caseId_key" ON "Fee"("caseId");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsProof" ADD CONSTRAINT "SavingsProof_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
