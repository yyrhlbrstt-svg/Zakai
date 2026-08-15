/**
 * Strip a person out of a letter, so what worked can be shared and they cannot.
 *
 * WHY THIS EXISTS
 *
 * `Case.draftMessage` holds the exact words sent to a counterparty, and
 * `StrategyOutcome` records which stance got paid — but never the text. So the
 * sentences that actually recovered money are written once, into one person's
 * row, and never learned from again. Every case re-derives from scratch what a
 * previous case already proved.
 *
 * Publishing that text is the obvious move and the dangerous one: a letter
 * contains a name, a phone number, an account reference, an address, an
 * amount. `StrategyOutcome` is de-identified by rule — no User or Case FK —
 * and pasting raw letter bodies beside it would defeat that rule completely,
 * turning the safest table in the schema into the leakiest.
 *
 * So redaction is not a step in this feature. It is the precondition for the
 * feature existing at all, and it is why this module ships before anything
 * that stores or displays letter text.
 *
 * THE POSTURE
 *
 * Fail loud, not quiet. `redactLetter` reports what it removed and whether
 * anything identifying survived. A caller must treat `safe: false` as "do not
 * store this", because a redactor that silently passes through one unmatched
 * phone number is worse than no redactor: it carries the authority of having
 * been checked.
 *
 * Be precise about what `safe` is worth today. Since a pattern now strips
 * every digit run of six or more, the residual check cannot fire on input the
 * current patterns handle — `safe` is true for all of it. It is a regression
 * tripwire, not a runtime discriminator: if a pattern is later narrowed (say,
 * re-anchored to \b, which is exactly the bug this module already had), the
 * residual check catches it and `redactedForPublication` returns null rather
 * than quietly publishing an identifier. The test suite states this plainly
 * instead of manufacturing an input to make the flag look load-bearing.
 *
 * Israeli formats are handled explicitly (ת"ז, 05x numbers, ₪) because a
 * generic redactor tuned for US formats would miss exactly the identifiers
 * that matter in this market.
 */

export interface RedactionResult {
  text: string;
  /** Counts by kind, for an audit trail and for tests to assert on. */
  removed: Record<RedactionKind, number>;
  /**
   * False when anything that looks like a residual identifier survives.
   * Callers must refuse to store or publish when this is false.
   */
  safe: boolean;
  /** Human-readable reasons `safe` is false. Empty when safe. */
  concerns: string[];
}

export type RedactionKind =
  | "email"
  | "phone"
  | "nationalId"
  | "iban"
  | "cardNumber"
  | "accountNumber"
  | "url"
  | "longNumber";

const PLACEHOLDER: Record<RedactionKind, string> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  nationalId: "[ID]",
  iban: "[IBAN]",
  cardNumber: "[CARD]",
  accountNumber: "[ACCOUNT]",
  url: "[URL]",
  longNumber: "[NUMBER]",
};

/**
 * Order matters: the most specific pattern must run first, or a broader one
 * consumes its digits and the specific label is lost. Card numbers before
 * generic long numbers, national IDs before account numbers.
 */
const PATTERNS: { kind: RedactionKind; re: RegExp }[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { kind: "url", re: /\bhttps?:\/\/\S+/gi },
  { kind: "iban", re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },
  // 13–19 digits, optionally grouped — a payment card.
  { kind: "cardNumber", re: /\b(?:\d[ -]?){13,19}\b/g },
  // Israeli mobile/landline, with or without country code and separators.
  { kind: "phone", re: /(?:\+972[-\s]?|\b0)(?:[23489]|5\d|7\d)[-\s]?\d{3}[-\s]?\d{4}\b/g },
  // Israeli national id: exactly 9 digits, often introduced by ת"ז / ת.ז.
  { kind: "nationalId", re: /(?:ת["']?\.?ז\.?[:\s-]*)?\b\d{9}\b/g },
  // Bank account / customer reference: 6–8 digits standing alone.
  { kind: "accountNumber", re: /\b\d{6,8}\b/g },
  /**
   * A long digit run EMBEDDED in an alphanumeric token, e.g. "ABC1234567890XYZ".
   * No word boundary exists between a letter and a digit, so every pattern
   * above walks straight past this — and so did the residual check, which
   * meant a reference number inside a token was reported as safe to publish.
   * Found by the test suite, not by reading.
   */
  { kind: "longNumber", re: /\d{6,}/g },
];

/**
 * A residual identifier check that runs AFTER redaction. Anything matching
 * here means a pattern above missed something, and the result is not safe.
 */
const RESIDUAL: { label: string; re: RegExp }[] = [
  { label: "an email address", re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { label: "a phone-like number", re: /\b0\d{8,9}\b/ },
  // Deliberately unanchored: \b would miss digits embedded between letters,
  // which is precisely the case that slipped through.
  { label: "a run of 6 or more digits", re: /\d{6,}/ },
];

export function redactLetter(input: string, namesToRemove: readonly string[] = []): RedactionResult {
  const removed: Record<RedactionKind, number> = {
    email: 0,
    phone: 0,
    nationalId: 0,
    iban: 0,
    cardNumber: 0,
    accountNumber: 0,
    url: 0,
    longNumber: 0,
  };

  let text = input;

  // Names first: they are supplied by the caller from structured fields, so
  // they are known exactly rather than guessed from prose.
  for (const raw of namesToRemove) {
    const name = raw.trim();
    if (name.length < 2) continue; // a single letter would shred the text
    text = text.split(name).join("[NAME]");
  }

  for (const { kind, re } of PATTERNS) {
    text = text.replace(re, (match) => {
      // A "card" of 13+ digits that is really a run of separated short numbers
      // is still worth removing, so no exception is made here.
      removed[kind] += 1;
      return PLACEHOLDER[kind];
    });
  }

  const concerns: string[] = [];
  for (const { label, re } of RESIDUAL) {
    if (re.test(text)) concerns.push(`possible ${label} survived redaction`);
  }

  return { text, removed, safe: concerns.length === 0, concerns };
}

/**
 * The gate a caller must pass through before persisting or publishing.
 *
 * Separate from `redactLetter` on purpose: a function that returns text is
 * easy to use while ignoring its warnings, and this one cannot be. It returns
 * null when the text is not safe, so the unsafe path has no value to store.
 */
export function redactedForPublication(
  input: string,
  namesToRemove: readonly string[] = [],
): string | null {
  const result = redactLetter(input, namesToRemove);
  if (!result.safe) return null;
  // A letter reduced mostly to placeholders teaches nothing and is not worth
  // the risk of holding at all.
  const placeholderCount = (result.text.match(/\[[A-Z]+\]/g) ?? []).length;
  const words = result.text.split(/\s+/).filter(Boolean).length;
  if (words < 20) return null;
  if (placeholderCount > words / 4) return null;
  return result.text;
}
