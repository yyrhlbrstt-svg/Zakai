-- Product tiers (Free / Pro / Max).

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'MAX');

-- AlterTable: every existing user starts on FREE.
ALTER TABLE "User" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN "planChangedAt" TIMESTAMP(3);
