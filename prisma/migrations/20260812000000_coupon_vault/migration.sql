-- The person's own coupon vault. Codes are bearer value: scoped to one user,
-- cascaded on account deletion, never shared across accounts.
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "percentOff" INTEGER,
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "minSpendMinor" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Coupon_userId_expiresAt_idx" ON "Coupon"("userId", "expiresAt");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
