-- Make the two history tables append-only in the database, not only by convention.
--
-- Both already claim it. events/spine.ts says "This module exposes no update and
-- no delete. A correction is a new event. An edited history is not a history."
-- securityEvent.ts exposes only a create. Neither claim is enforced anywhere: a
-- future module, a migration, or anybody holding the connection string can
-- rewrite either table and leave no trace that they did.
--
-- That matters more for these two than for any other table here. Every other
-- table describes the present and can be rebuilt from reality; these two are the
-- only record of what happened, and the entire value of an audit row is that it
-- could not have been changed after the fact. A guarantee that lives in a
-- comment is not a guarantee.

CREATE OR REPLACE FUNCTION zakai_append_only_reject()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'append-only table "%": % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

-- ---------------------------------------------------------------------------
-- SecurityEvent: nothing may change, ever.
-- ---------------------------------------------------------------------------

CREATE TRIGGER security_event_no_update
  BEFORE UPDATE ON "SecurityEvent"
  FOR EACH ROW EXECUTE FUNCTION zakai_append_only_reject();

CREATE TRIGGER security_event_no_delete
  BEFORE DELETE ON "SecurityEvent"
  FOR EACH ROW EXECUTE FUNCTION zakai_append_only_reject();

-- Row triggers do not see TRUNCATE, which is the obvious way around them.
CREATE TRIGGER security_event_no_truncate
  BEFORE TRUNCATE ON "SecurityEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION zakai_append_only_reject();

-- ---------------------------------------------------------------------------
-- ZakaiEvent: one update is legitimate and must keep working.
--
-- ZakaiEvent.caseId is `onDelete: SetNull`, and User → Case is `Cascade`. So
-- deleting an account deletes its cases, and Postgres detaches the events by
-- UPDATEing caseId to NULL. A blanket update block would make account deletion
-- fail — turning a privacy guarantee into a privacy bug, which is the exact
-- opposite of the point.
--
-- So that one transition is allowed and nothing else is: the event's content
-- stays frozen, only its link to a case that no longer exists is released.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION zakai_event_append_only_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."caseId" IS NULL
     AND OLD."id"          IS NOT DISTINCT FROM NEW."id"
     AND OLD."eventType"   IS NOT DISTINCT FROM NEW."eventType"
     AND OLD."institution" IS NOT DISTINCT FROM NEW."institution"
     AND OLD."domain"      IS NOT DISTINCT FROM NEW."domain"
     AND OLD."payload"     IS NOT DISTINCT FROM NEW."payload"
     AND OLD."occurredAt"  IS NOT DISTINCT FROM NEW."occurredAt"
     AND OLD."recordedAt"  IS NOT DISTINCT FROM NEW."recordedAt"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'append-only table "ZakaiEvent": the only permitted UPDATE is the caseId detach on case deletion'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER zakai_event_restricted_update
  BEFORE UPDATE ON "ZakaiEvent"
  FOR EACH ROW EXECUTE FUNCTION zakai_event_append_only_update();

CREATE TRIGGER zakai_event_no_delete
  BEFORE DELETE ON "ZakaiEvent"
  FOR EACH ROW EXECUTE FUNCTION zakai_append_only_reject();

CREATE TRIGGER zakai_event_no_truncate
  BEFORE TRUNCATE ON "ZakaiEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION zakai_append_only_reject();
