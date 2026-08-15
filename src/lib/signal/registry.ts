import type { MarketEvent } from "@/lib/signal/types";
import { validateEvent } from "@/lib/signal/validate";

/**
 * Everything that has gone wrong, that somebody is owed something for.
 *
 * WHY IT SHIPS EMPTY
 *
 * There is not a single event in this list, and that is the correct state for
 * it today.
 *
 * The temptation was to seed it — a bank fine here, a class action there, so
 * the feature "does something" on the first run. Every one of those would have
 * been written from memory by a model that cannot open the regulator's website
 * from this machine, and the result is a screen that tells a real person they
 * are owed real money on the strength of a half-remembered headline. That is
 * not a smaller version of the product. It is the opposite of it: the only
 * thing this company has to sell is that when it says money is owed, money is
 * owed.
 *
 * So the engine stands, the gate is closed, and the list fills when somebody
 * with a source in front of them adds an entry. An empty registry that refuses
 * to lie is worth more than a full one that might.
 *
 * WHAT AN ENTRY COSTS
 *
 * A publisher, a URL a person can open, a publication date, an eligibility
 * rule made of the closed set in `types.ts`, and a route inside this app that
 * starts the claim. `validateEvent` refuses anything missing any of those, and
 * refuses `confidence: "confirmed"` unless the publisher is a primary source.
 * Roughly fifteen minutes with the regulator's page open — which is the point:
 * cheap enough to do often, expensive enough that nobody does it from memory.
 *
 * WHY A FILE AND NOT A DATABASE TABLE
 *
 * Because an event is a claim about the world that somebody should have to
 * review, and a file gets reviewed. An admin form writing straight to a table
 * turns "tell ten thousand people they are owed money" into an action one
 * person takes alone at midnight. When the volume justifies a table, the table
 * should still be fed through this same validator, and the review should move
 * rather than disappear.
 */
export const MARKET_EVENTS: readonly MarketEvent[] = [];

/**
 * Validate the whole registry.
 *
 * Called by the test suite rather than at import time: a bad entry should fail
 * the build of the person who added it, not take production down at boot on a
 * Sunday. The test is the gate; this is the gate's implementation.
 */
export function validateRegistry(
  events: readonly MarketEvent[] = MARKET_EVENTS,
  today: string = new Date().toISOString().slice(0, 10),
): void {
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) {
      throw new Error(`duplicate event id "${event.id}" — ids appear in URLs and citations`);
    }
    seen.add(event.id);
    validateEvent(event, today);
  }
}

/** Events for one jurisdiction, newest first. */
export function eventsForMarket(
  jurisdiction: string,
  events: readonly MarketEvent[] = MARKET_EVENTS,
): MarketEvent[] {
  return events
    .filter((e) => e.jurisdiction.toUpperCase() === jurisdiction.toUpperCase())
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
