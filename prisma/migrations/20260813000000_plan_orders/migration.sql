-- A paid plan period somebody actually bought. Separate from Fee, which is
-- one-to-one with a Case; this is the subscription line, which needs no Case,
-- no Mandate and no outbound mail.
CREATE TYPE "PlanOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE "PlanOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "amount" INTEGER NOT NULL,
    "status" "PlanOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT '',
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanOrder_userId_createdAt_idx" ON "PlanOrder"("userId", "createdAt");
CREATE INDEX "PlanOrder_status_createdAt_idx" ON "PlanOrder"("status", "createdAt");

ALTER TABLE "PlanOrder" ADD CONSTRAINT "PlanOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- When a paid plan lapses. Null on FREE and on any plan granted without payment.
ALTER TABLE "User" ADD COLUMN "planUntil" TIMESTAMP(3);
