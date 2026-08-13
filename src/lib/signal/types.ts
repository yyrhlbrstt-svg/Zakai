/**
 * When something goes wrong in the world, money becomes owed to people who
 * will never hear about it.
 *
 * WHAT THIS IS
 *
 * A bank is fined for overcharging a fee for six years. An insurer is found to
 * have sold a policy that could never pay out. A class action is certified and
 * a settlement fund opens with a claim window. An airline strike grounds forty
 * thousand people, every one of whom is owed a fixed statutory sum. A recall.
 *
 * In every one of those the money exists, the entitlement is real, and the
 * overwhelming majority of the people owed it never claim — because the news
 * reached a business section and never reached them, and because the path from
 * "I read that" to "I filed that" is three hours of work nobody does.
 *
 * The rest of this product waits for somebody to arrive and ask. This does the
 * opposite: it holds a standing, machine-readable map of what has gone wrong,
 * who it happened to, and what each person can claim — so that the moment an
 * event is recorded, everybody it touches has a case path rather than a
 * headline.
 *
 * WHY THIS IS A DIFFERENT KIND OF ASSET
 *
 * Every other part of Zakai gets better when a user arrives. This gets better
 * whether or not anybody arrives, and it does not decay: an event encoded
 * today is inventory for years, because claim windows outlive news cycles.
 * It is also counter-cyclical — it grows when the economy hurts, which is
 * exactly when the people it serves need it most.
 *
 * THE RULE THAT MAKES IT TRUSTWORTHY OR WORTHLESS
 *
 * No event without a source. Not "a source would be nice" — an event with no
 * publisher, URL and publication date is not representable by these types, and
 * `validateEvent` refuses it. The first non-negotiable in CLAUDE.md is that we
 * never fabricate eligibility, and a system that tells thousands of people
 * they are owed money is the one place where fabricating it would do the most
 * damage: to them, and to the only thing this company sells, which is that
 * when Zakai says money is owed, money is owed.
 *
 * A model may propose an event. It may never enter the registry without a
 * human-checkable citation, and eligibility is decided by the closed rule set
 * below rather than by a model — the division this codebase applies
 * everywhere: the model proposes, the code decides.
 */

/** What kind of thing happened. Closed, because each kind implies a claim shape. */
export type MarketEventKind =
  | "regulatory_fine"
  | "regulatory_ruling"
  | "class_action"
  | "data_breach"
  | "recall"
  | "service_failure"
  | "insolvency"
  | "unlawful_charge";

/** How sure we are, stated rather than implied. */
export type EventConfidence =
  /** A regulator, a court, or the company itself published it. */
  | "confirmed"
  /** Credibly reported, not yet confirmed by a primary source. */
  | "reported";

/**
 * Where the fact came from.
 *
 * Required on every event, with no optional fields. A citation that is
 * sometimes absent is a citation nobody checks.
 */
export interface EventSource {
  /** The body that published it — a regulator, a court, the company. */
  publisher: string;
  /** A URL a person can open and read for themselves. */
  url: string;
  /** ISO date. Claim windows are computed from it, so it is not decorative. */
  publishedAt: string;
}

/**
 * Who an event applies to.
 *
 * A closed, serializable set rather than a predicate function, for three
 * reasons that all matter: rules can be stored in a database and audited by
 * somebody who does not read TypeScript; a rule arriving from an admin form or
 * a feed can never become executable code; and every rule can be explained
 * back to the person it matched — which is the difference between "you are
 * owed money" and "you are owed money because you held this account with this
 * provider between these dates".
 */
export type EligibilityRule =
  /** The person has a case or a detected charge with this counterparty. */
  | { kind: "hasProvider"; provider: string }
  /** …and the relationship overlapped the window the event covers. */
  | { kind: "hadProviderBetween"; provider: string; from: string; to: string }
  /** Jurisdiction gate — most events are national. */
  | { kind: "inCountry"; country: string }
  /** The person's own claim is in a vertical the event applies to. */
  | { kind: "inVertical"; vertical: string }
  /** Every child must match. */
  | { kind: "all"; rules: EligibilityRule[] }
  /** At least one child must match. */
  | { kind: "any"; rules: EligibilityRule[] };

/** The de-identified facts a rule is allowed to see. Nothing else is passed in. */
export interface EligibilityFacts {
  country: string;
  /** Provider keys the person has any relationship with, however detected. */
  providers: readonly string[];
  /** Provider key → [start, end] ISO dates of the known relationship. */
  providerWindows?: Readonly<Record<string, readonly [string, string]>>;
  verticals?: readonly string[];
}

/**
 * What the person can actually do about it.
 *
 * `path` is a route in this product, because an event that ends in "consult a
 * lawyer" is a headline with extra steps. If we cannot say what the person
 * does next, inside the app, the event is not ready to ship.
 */
export interface EventClaim {
  /** Which of our verticals carries the claim. */
  vertical: string;
  /** In-app route that starts it. */
  path: string;
  /**
   * Only when the amount is fixed by the ruling or the settlement — never an
   * estimate dressed as a figure. Integer agorot, like all money here.
   */
  fixedAmountAgorot?: number;
  /** ISO date after which the claim can no longer be filed, when one exists. */
  deadline?: string;
}

export interface MarketEvent {
  id: string;
  kind: MarketEventKind;
  /** Provider key this happened to — the same keys the rest of the app uses. */
  counterparty: string;
  /** ISO 3166-1 alpha-2. */
  jurisdiction: string;
  /**
   * One plain sentence, in the reader's words, per locale.
   *
   * A map rather than `headlineHe` + `headlineEn`, which is what this started
   * as. Two fields is not a smaller version of a map — it is a shape in which
   * Arabic, Russian, German and French *cannot be expressed at all*, so those
   * readers would have received English forever and the gap would never have
   * shown up as a missing translation anywhere. `he` and `en` are required
   * because the validator needs two known-good strings to check; any other
   * locale is optional and falls back.
   */
  headline: Record<string, string>;
  /** When the thing happened, which is often long before it was published. */
  occurredAt: string;
  source: EventSource;
  confidence: EventConfidence;
  eligibility: EligibilityRule;
  claim: EventClaim;
}
