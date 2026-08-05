/** Cap on written agent follow-up rounds — shared by auto-send and next-action ranking. */
export const MAX_AGENT_ROUNDS = 4;

/** Subject marker for agent auto-follow-ups — round accounting + Outbox drain. */
export const AGENT_SUBJECT_PREFIX = "זכאי סיבוב";

/**
 * Cold default days a SENT case should wait before HITL / overnight follow-up.
 * Prefer `followUpAfterDays(cohort.medianDaysToWin)` when outcome volume exists.
 */
export const SENT_FOLLOWUP_AFTER_DAYS = 5;
