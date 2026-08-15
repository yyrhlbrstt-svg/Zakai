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
 * Why somebody matched — as a code and its facts, never as a sentence.
 *
 * These strings used to be built here, in Hebrew, inside a pure module: "יש
 * לכם התנהלות מול cellcom". That meant an Arabic or Russian reader — whose
 * whole interface is already translated — would be handed the one sentence
 * that matters most, the one justifying a claim that money is owed to them,
 * in a language they may not read. And it would never have surfaced as a
 * missing translation anywhere, because from the catalogue's point of view
 * nothing was missing.
 *
 * A code plus its parameters is also the honest shape for a different reason:
 * it is the machine-readable record of *why we said this*, which is what
 * somebody would ask for six months later, and a rendered sentence is not.
 */
export type MatchReason =
  | { code: "inCountry"; country: string }
  | { code: "hasProvider"; provider: string }
  | { code: "hadProviderBetween"; provider: string; from: string; to: string }
  | { code: "inVertical"; vertical: string };

export interface EligibilityResult {
  matched: boolean;
  /** Every leaf rule that matched. Empty when it did not. */
  because: MatchReason[];
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

function evaluate(rule: EligibilityRule, facts: EligibilityFacts, because: MatchReason[]): boolean {
  switch (rule.kind) {
    case "inCountry": {
      const ok = facts.country.toUpperCase() === rule.country.toUpperCase();
      // "במדינה: IL" is our storage format read out loud. A person matched by
      // a nationwide order should be told it applies to everybody here, in
      // words — the country code is an implementation detail they never
      // agreed to learn.
      if (ok) because.push({ code: "inCountry", country: rule.country.toUpperCase() });
      return ok;
    }
    case "hasProvider": {
      const ok = facts.providers.includes(rule.provider);
      if (ok) because.push({ code: "hasProvider", provider: rule.provider });
      return ok;
    }
    case "hadProviderBetween": {
      const ok =
        facts.providers.includes(rule.provider) &&
        overlaps(facts.providerWindows?.[rule.provider], rule.from, rule.to);
      if (ok) {
        because.push({
          code: "hadProviderBetween",
          provider: rule.provider,
          from: rule.from,
          to: rule.to,
        });
      }
      return ok;
    }
    case "inVertical": {
      const ok = (facts.verticals ?? []).includes(rule.vertical);
      if (ok) because.push({ code: "inVertical", vertical: rule.vertical });
      return ok;
    }
    case "all": {
      // Reasons go to a scratch list and are kept only on success, so a rule
      // that failed halfway cannot leave half an explanation attached to a
      // match it did not make.
      const scratch: MatchReason[] = [];
      const ok = rule.rules.every((child) => evaluate(child, facts, scratch));
      if (ok) because.push(...scratch);
      return ok;
    }
    case "any": {
      for (const child of rule.rules) {
        const scratch: MatchReason[] = [];
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
  const because: MatchReason[] = [];
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
): Array<{ event: MarketEvent; because: MatchReason[]; claimOpen: boolean }> {
  return events
    .map((event) => ({ event, ...checkEligibility(event.eligibility, facts) }))
    .filter((row) => row.matched)
    .map(({ event, because }) => ({ event, because, claimOpen: isClaimOpen(event, on) }))
    .sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt));
}
