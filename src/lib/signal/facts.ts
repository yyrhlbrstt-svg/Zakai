import type { EligibilityFacts } from "@/lib/signal/types";

/**
 * What we know about somebody, reduced to the few facts a rule may see.
 *
 * WHY THIS IS A SEPARATE, PURE FUNCTION
 *
 * This is the join between a person's real history and a statement that money
 * is owed to them. Two things have to be true of it and neither survives being
 * written inline in a query:
 *
 * 1. It must be testable without a database, because the failure that matters
 *    — a window derived slightly too wide — produces a confident false claim
 *    of entitlement, and that is not something to discover in production.
 *
 * 2. It must be visibly narrow. A rule can see the country, the provider keys,
 *    the dates those relationships were observed, and the verticals. Not the
 *    name, not the amounts, not the email. Keeping that list short is what
 *    lets the matching run over many people at once without the blast radius
 *    of a leak growing with it.
 *
 * WHAT A WINDOW MEANS HERE, AND WHAT IT DOES NOT
 *
 * `providerWindows` is *when we observed the relationship*, not when it
 * existed. Somebody who opened a case about their bank in March 2026 was
 * almost certainly a customer long before that, and we do not know from when.
 *
 * That distinction decides whether this system is honest. Widening an observed
 * window into a guessed one is the single change that would make it match far
 * more people and start telling some of them something untrue. So the window
 * is exactly what was seen, `hadProviderBetween` needs a real overlap, and a
 * provider with no dated evidence gets no window at all — it will match
 * `hasProvider` and refuse every dated rule, which is the correct answer to
 * "we do not know".
 */

/** The shape of a case row this needs. Deliberately smaller than the model. */
export interface CaseFact {
  provider: string;
  vertical: string;
  /** When we first saw this relationship. */
  createdAt: Date;
  /** When we last saw it live. */
  updatedAt: Date;
}

/** A recurring charge detected in a scan — a relationship, without a case. */
export interface ChargeFact {
  provider: string;
  /** When the scan that saw it ran. A charge is evidence of a live account. */
  observedAt: Date;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildEligibilityFacts(input: {
  country: string;
  cases: readonly CaseFact[];
  charges?: readonly ChargeFact[];
}): EligibilityFacts {
  const providers = new Set<string>();
  const verticals = new Set<string>();
  const windows: Record<string, [string, string]> = {};

  const widen = (provider: string, from: Date, to: Date) => {
    const lo = iso(from);
    const hi = iso(to);
    const existing = windows[provider];
    if (!existing) {
      windows[provider] = [lo, hi];
      return;
    }
    // Several cases with the same provider are several sightings of one
    // relationship. The union of what was seen is still only what was seen.
    windows[provider] = [
      lo < existing[0] ? lo : existing[0],
      hi > existing[1] ? hi : existing[1],
    ];
  };

  for (const kase of input.cases) {
    providers.add(kase.provider);
    verticals.add(kase.vertical);
    // A case created after it was last updated is a clock problem, not a
    // relationship that ran backwards — order them rather than emit a window
    // no date can ever fall inside.
    const [from, to] =
      kase.createdAt <= kase.updatedAt
        ? [kase.createdAt, kase.updatedAt]
        : [kase.updatedAt, kase.createdAt];
    widen(kase.provider, from, to);
  }

  for (const charge of input.charges ?? []) {
    providers.add(charge.provider);
    // A single sighting is a window of one day. That is genuinely all it is:
    // a charge on a statement proves the account was live that day and says
    // nothing about the month before.
    widen(charge.provider, charge.observedAt, charge.observedAt);
  }

  return {
    country: input.country.toUpperCase(),
    providers: [...providers].sort(),
    providerWindows: windows,
    verticals: [...verticals].sort(),
  };
}
