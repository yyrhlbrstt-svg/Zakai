-- Family mode: an optional label for whom a check is run ("אמא", "אבא"…).
-- Empty string = the account owner themselves. Display grouping only; the
-- case remains owned by and scoped to its userId.

-- AlterTable
ALTER TABLE "Case" ADD COLUMN "beneficiaryLabel" TEXT NOT NULL DEFAULT '';
