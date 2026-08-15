-- Lets a completed password reset actually invalidate every session issued
-- before it (see getSessionUserId in src/lib/auth/session.ts). Nullable so
-- existing accounts are unaffected until they next reset.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
