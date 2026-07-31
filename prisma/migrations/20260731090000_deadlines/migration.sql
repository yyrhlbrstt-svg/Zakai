-- A personal reminder for a date the user cares about — no Case, no Mandate,
-- no fee. notifiedAt gates the cron so a deadline gets exactly one reminder
-- email, not one per daily cron run once it enters the reminder window.
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "remindDaysBefore" INTEGER NOT NULL DEFAULT 14,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Deadline_userId_idx" ON "Deadline"("userId");

ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
