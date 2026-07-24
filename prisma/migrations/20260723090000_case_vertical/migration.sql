-- Which full-service vertical a case belongs to (rule-pack key). Defaults to
-- "telecom" so all existing cases are unchanged.

-- AlterTable
ALTER TABLE "Case" ADD COLUMN "vertical" TEXT NOT NULL DEFAULT 'telecom';
