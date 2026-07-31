-- Institutional leads were emailed and never stored. With no SMTP transport
-- configured they were written to the Outbox, marked SENT, and delivered
-- nowhere — so a bank filling in the pilot form on /institutions vanished
-- without trace, which is the one enquiry this whole protocol exists to
-- attract. Persisting every lead first means the mail is a notification and
-- never the record.
--
-- Additive and nullable-by-default, so the existing rows are untouched: a
-- consumer lead has a phone and no email, an institutional one the reverse,
-- and neither has to be faked to satisfy the other's column.
ALTER TABLE "Lead" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ADD COLUMN "company" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ALTER COLUMN "phone" SET DEFAULT '';
