-- Country of signup (ISO-3166 alpha-2). Israel is the launch market; capturing
-- country makes international signups a demand signal for expansion.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'IL';
