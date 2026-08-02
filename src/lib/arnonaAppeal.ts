/**
 * Arnona discount / correction letters — reuses the canonical rights catalog
 * (`buildClaimDraft`) so agent cases and self-serve letters never diverge.
 */

import { buildClaimDraft, type ClaimFields } from "./claimDraft";

export const ARNONA_AGENT_RIGHTS = [
  "arnona_income",
  "arnona_oleh",
  "arnona_senior",
  "arnona_disability",
  "arnona_soldier",
  "arnona_large_family",
  "arnona_area_correction",
] as const;

export type ArnonaAgentRight = (typeof ARNONA_AGENT_RIGHTS)[number];

export function isArnonaAgentRight(id: string): id is ArnonaAgentRight {
  return (ARNONA_AGENT_RIGHTS as readonly string[]).includes(id);
}

export function buildArnonaAgentLetter(
  rightId: ArnonaAgentRight,
  fields: ClaimFields,
): { subject: string; body: string } | null {
  const draft = buildClaimDraft(rightId, fields);
  if (!draft) return null;
  return { subject: draft.subject, body: draft.body };
}
