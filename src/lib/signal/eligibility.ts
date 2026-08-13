import type { EligibilityFacts, EligibilityRule, MarketEvent } from "@/lib/signal/types";

/**
 * Whether an event applies to a person, and why.
 *
 * The "why" is not a nicety. This is the one place in the product that tells
 * somebody money is owed to them before they suspected it, and the only
 * defence against that reading as a marketing claim is being able to answer
 * "because you held this account with this provider during this window" in the
 * same breath. An unexplained match is a guess with confidence.
 *
 * Deterministic and total: no model, no network, no clock beyond what is
 * passed in. The same facts and the same rule give the same answer forever,
 * which is what makes a match reproducible six months later when somebody asks
 * how we decided.
 */

/**
 * Country codes as a person says them.
 *
 * Only the markets with live tools. An unknown code falls back to a phrase
 * that is vague and true rather than precise and meaningless.
 */
const COUNTRY_IN: Record<string, string> = {
  IL: "בישראל",
  GB: "בבריטניה",
  US: "בארצות הברית",
  DE: "בגרמניה",
  FR: "בצרפת",
};

export interface EligibilityResult {
  matched: boolean;
  /** Every leaf rule that matched, in the reader's terms. Empty when it did not. */
  because: string[];
}

function overlaps(
  window: readonly [string, string] | undefined,
  from: string,
  to: string,
): boolean {
  if (!window) return false;
  const [start, end] = window;
  // Inclusive on both sides: a relationship that ended the day the window
  // opened still overlapped it, and claim windows are generous by design.
  return start <= to && end >= from;
}

function evaluate(rule: EligibilityRule, facts: EligibilityFacts, because: string[]): boolean {
  switch (rule.kind) {
    case "inCountry": {
      const ok = facts.country.toUpperCase() === rule.country.toUpperCase();
      // "במדינה: IL" is our storage format read out loud. A person matched by
      // a nationwide order should be told it applies to everybody here, in
      // words — the country code is an implementation detail they never
      // agreed to learn.
      if (ok) because.push(`זה חל על כל מי ש${COUNTRY_IN[rule.country.toUpperCase()] ?? "במדינה הזו"}`);
      return ok;
    }
    case "hasProvider": {
      const ok = facts.providers.includes(rule.provider);
      if (ok) because.push(`יש לכם התנהלות מול ${rule.provider}`);
      return ok;
    }
    case "hadProviderBetween": {
      const ok =
        facts.providers.includes(rule.provider) &&
        overlaps(facts.providerWindows?.[rule.provider], rule.from, rule.to);
      if (ok) because.push(`הייתם לקוחות של ${rule.provider} בין ${rule.from} ל-${rule.to}`);
      return ok;
    }
    case "inVertical": {
      const ok = (facts.verticals ?? []).includes(rule.vertical);
      if (ok) because.push(`יש לכם תיק בתחום ${rule.vertical}`);
      return ok;
    }
    case "all": {
      // Reasons go to a scratch list and are kept only on success, so a rule
      // that failed halfway cannot leave half an explanation attached to a
      // match it did not make.
      const scratch: string[] = [];
      const ok = rule.rules.every((child) => evaluate(child, facts, scratch));
      if (ok) because.push(...scratch);
      return ok;
    }
    case "any": {
      for (const child of rule.rules) {
        const scratch: string[] = [];
        if (evaluate(child, facts, scratch)) {
          because.push(...scratch);
          return true;
        }
      }
      return false;
    }
  }
}

export function checkEligibility(
  rule: EligibilityRule,
  facts: EligibilityFacts,
): EligibilityResult {
  const because: string[] = [];
  const matched = evaluate(rule, facts, because);
  return { matched, because: matched ? because : [] };
}

/**
 * Is this claim still filable on the given day?
 *
 * Separate from eligibility on purpose. Somebody who was affected but is out of
 * time is still owed the truth about what happened to them — saying "you do not
 * match" would be false — and sending them to file something that will be
 * rejected wastes the one thing they have left. Two different facts, reported
 * as two different facts.
 */
export function isClaimOpen(event: MarketEvent, on: Date): boolean {
  if (!event.claim.deadline) return true;
  // Date-only comparison: a deadline is a day, not an instant, and treating it
  // as midnight UTC quietly closes a claim early for anybody east of it.
  return on.toISOString().slice(0, 10) <= event.claim.deadline;
}

/** Events that apply to this person, newest first, each with its reasons. */
export function matchEvents(
  events: readonly MarketEvent[],
  facts: EligibilityFacts,
  on: Date,
): Array<{ event: MarketEvent; because: string[]; claimOpen: boolean }> {
  return events
    .map((event) => ({ event, ...checkEligibility(event.eligibility, facts) }))
    .filter((row) => row.matched)
    .map(({ event, because }) => ({ event, because, claimOpen: isClaimOpen(event, on) }))
    .sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt));
}
