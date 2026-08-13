import "server-only";
import { prisma } from "@/lib/prisma";
import { buildEligibilityFacts } from "@/lib/signal/facts";
import { matchEvents } from "@/lib/signal/eligibility";
import { MARKET_EVENTS } from "@/lib/signal/registry";
import type { MarketEvent } from "@/lib/signal/types";

/**
 * What has gone wrong that touches this particular person.
 *
 * This is the only place in the product that speaks first. Everything else
 * waits to be asked: somebody arrives, uploads a statement, gets an answer.
 * Here Zakai says something unprompted, about money, to somebody who did not
 * ask — which makes it the most valuable thing the product can do and the
 * easiest to do damage with.
 *
 * Two properties hold that line, and both are enforced upstream rather than
 * here: an event cannot exist without a citation (`validateEvent`), and a
 * match cannot exist without a reason in the reader's words
 * (`checkEligibility`). This function's own job is narrow — read the few facts
 * a rule may see, run the rules, and pass the reasons through untouched.
 */

export interface SignalMatch {
  event: MarketEvent;
  /** Why this person matched, in their terms. Shown, never summarised away. */
  because: string[];
  /** False when the filing window has closed. Still worth telling them. */
  claimOpen: boolean;
}

/**
 * How much history a match may be built from.
 *
 * Capped rather than unbounded because this runs on a page load. Cases are
 * read newest-first, so a person with hundreds still gets matched on their
 * recent relationships — and a relationship from four hundred cases ago is
 * one we have no dated evidence for anyway.
 */
const MAX_CASES = 200;

export async function signalMatchesForUser(
  userId: string,
  now: Date = new Date(),
): Promise<SignalMatch[]> {
  // Nothing to match against: skip the database entirely rather than paying
  // for a query whose result cannot change the answer.
  if (MARKET_EVENTS.length === 0) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true },
  });
  if (!user) return [];

  const cases = await prisma.case.findMany({
    where: { userId },
    select: { provider: true, vertical: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_CASES,
  });

  const facts = buildEligibilityFacts({
    country: user.country || "IL",
    cases,
  });

  return matchEvents(MARKET_EVENTS, facts, now);
}

/**
 * The same question for somebody who is not signed in.
 *
 * A guest has no cases, so only jurisdiction-wide events can match — the ones
 * that hit everybody in a country rather than everybody with a particular
 * provider. That is a real and useful subset: a nationwide refund order does
 * not care who you bank with.
 */
export function signalMatchesForGuest(country: string, now: Date = new Date()): SignalMatch[] {
  if (MARKET_EVENTS.length === 0) return [];
  return matchEvents(
    MARKET_EVENTS,
    { country: country.toUpperCase(), providers: [], providerWindows: {}, verticals: [] },
    now,
  );
}
