import type { MarketEvent } from "@/lib/signal/types";

/**
 * The gate between "somebody said this happened" and "we told ten thousand
 * people they are owed money".
 *
 * This is the highest-consequence validation in the codebase. Everywhere else,
 * a bad input produces a bad answer for one person who can see it is wrong.
 * Here it produces a confident, personalised, unsolicited claim of
 * entitlement, sent to everybody the rule matches, about money — and the
 * people most likely to act on it are the ones least able to absorb being
 * wrong.
 *
 * So the rule is not "validate the shape". It is: an event that cannot be
 * checked by a human reading its citation does not exist. Every refusal below
 * is a refusal to publish something unverifiable, not a type check.
 */

export class EventInvalid extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Publishers whose word is a primary source. Not a whitelist of who may be
 * cited — a marker of which events may claim `confidence: "confirmed"`.
 * Anything else is `reported`, and the difference is shown to the reader.
 */
const PRIMARY_PUBLISHERS = [
  /בנק ישראל/,
  /רשות ניירות ערך/,
  /רשות שוק ההון/,
  /הרשות להגנת הצרכן/,
  /רשות התחרות/,
  /בית המשפט/,
  /משרד המשפטים/,
  /gov\.il/i,
];

function isPrimary(publisher: string, url: string): boolean {
  return PRIMARY_PUBLISHERS.some((p) => p.test(publisher) || p.test(url));
}

/**
 * Refuse anything that cannot be checked, dated, or acted on.
 *
 * Throws rather than returning a result, because every caller — the admin
 * form, a feed importer, the registry's own startup check — must fail loudly.
 * A validator whose result can be ignored is a suggestion.
 */
export function validateEvent(event: MarketEvent, today: string): void {
  const bad = (why: string): never => {
    throw new EventInvalid(`${event.id}: ${why}`);
  };

  if (!event.id.trim()) bad("no id");
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(event.id)) {
    bad("id must be a stable lowercase slug — it appears in URLs and in citations");
  }

  // --- The citation, which is the whole reason to believe any of this -------
  const { publisher, url, publishedAt } = event.source;
  if (!publisher.trim()) bad("no publisher — an uncited event is a rumour with a schema");
  if (!/^https:\/\/\S+\.\S+/.test(url)) {
    bad("source url must be an https link a person can open and read");
  }
  if (!ISO_DATE.test(publishedAt)) bad("source.publishedAt must be an ISO date");
  if (!ISO_DATE.test(event.occurredAt)) bad("occurredAt must be an ISO date");

  /**
   * Published before it happened is not a rounding error. It is the signature
   * of a date that was guessed, and a guessed date silently corrupts every
   * claim window computed from it.
   */
  if (publishedAt < event.occurredAt) {
    bad(`published ${publishedAt} but occurred ${event.occurredAt}`);
  }
  if (publishedAt > today) bad(`source is dated ${publishedAt}, in the future`);

  if (event.confidence === "confirmed" && !isPrimary(publisher, url)) {
    bad(
      `claims "confirmed" but ${publisher} is not a primary source — ` +
        `use "reported", which is shown to the reader as such`,
    );
  }

  // --- What the person actually does about it ------------------------------
  if (!event.claim.path.startsWith("/")) {
    bad("claim.path must be an in-app route — an event that ends in advice is a headline");
  }
  if (event.claim.deadline && !ISO_DATE.test(event.claim.deadline)) {
    bad("claim.deadline must be an ISO date");
  }
  if (event.claim.deadline && event.claim.deadline < event.occurredAt) {
    bad("claim closed before the event happened");
  }
  if (
    event.claim.fixedAmountAgorot !== undefined &&
    (!Number.isInteger(event.claim.fixedAmountAgorot) || event.claim.fixedAmountAgorot <= 0)
  ) {
    bad("fixedAmountAgorot must be a positive integer in agorot, or absent");
  }

  // --- The words a person reads --------------------------------------------
  for (const [field, text] of [
    ["headlineHe", event.headlineHe],
    ["headlineEn", event.headlineEn],
  ] as const) {
    if (text.trim().length < 12) bad(`${field} is too short to tell anybody anything`);
    if (text.length > 160) bad(`${field} is longer than a sentence`);
  }

  if (!/^[A-Z]{2}$/.test(event.jurisdiction)) bad("jurisdiction must be ISO 3166-1 alpha-2");
  if (!event.counterparty.trim()) bad("no counterparty");
}
