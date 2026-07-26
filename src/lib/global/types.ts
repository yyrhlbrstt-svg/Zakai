/**
 * The global layer — what turns Zakai from an Israeli product into
 * infrastructure that a second, tenth and hundredth country plug into.
 *
 * WHY THIS EXISTS
 *
 * `src/lib/rights.ts` encodes Israel directly in TypeScript closures:
 *
 *     { id: "work_grant", eligible: (p) => working(p) && p.lowIncome }
 *
 * That is fine for one country and fatal for two hundred. Eligibility written
 * as code means every new jurisdiction is a code change, a deploy, a
 * regression risk and an engineer who has to understand Bulgarian benefit law.
 * This is the specific reason every competitor in this space is stuck in a
 * single market — not marketing, not capital. Architecture.
 *
 * So the engine here knows nothing about any country. Eligibility is a small
 * declarative predicate tree, evaluated by a generic interpreter. A
 * jurisdiction is a **data pack**: rights, predicates, amounts in minor units,
 * statutory citations, and the in-app action that fulfils each one.
 *
 * Three consequences that matter:
 *
 *  1. **Adding a country is adding a file.** No engine change, no deploy risk
 *     to existing markets, and the work can be done by a lawyer with a schema
 *     rather than an engineer with a spec.
 *  2. **Packs are reviewable and citable.** Every right carries `source`. A
 *     rights platform that cannot show the statute it is relying on is not
 *     trustworthy at any scale, and citation is what makes outside
 *     contribution safe to accept.
 *  3. **Three independent axes, deliberately unconflated.** UI language,
 *     jurisdiction, and document language are separate. A Ukrainian living in
 *     Germany reads the app in Russian, is governed by German law, and the
 *     letter that leaves the building is in German. Today the codebase assumes
 *     all three are "Hebrew"; that assumption is the thing that does not
 *     survive a border.
 */

// ---------------------------------------------------------------------------
// The universal profile
// ---------------------------------------------------------------------------

/**
 * Facts that determine entitlement almost everywhere on Earth. Deliberately
 * small: the moment a country needs its own question, it goes in `extra`
 * rather than growing the shared shape and forcing every other pack to care.
 *
 * Ages are years, not buckets. Buckets are a UI concern; encoding them in the
 * profile bakes one country's thresholds (67 in Israel, 66 in the UK, 62 in
 * France) into the shared type.
 */
export interface UniversalProfile {
  ageYears: number;
  employment:
    | "employee"
    | "self_employed"
    | "unemployed"
    | "student"
    | "military"
    | "retired"
    | "other";
  /** Children or other dependents in the household. */
  dependents: number;
  /** Of those, how many are under six (childcare/daycare thresholds). */
  dependentsUnder6: number;
  housing: "renting" | "owner" | "other";
  /** Relative to the local median — packs decide what that means locally. */
  incomeBand: "low" | "medium" | "high";
  hasDisability: boolean;
  partnered: boolean;
  /** Years since immigrating, when relevant. Undefined = not a recent migrant. */
  migrantYears?: number;
  /** Currently serving or liable for reserve military duty. */
  militaryReserve: boolean;
  /** Discharged from military service within the local eligibility window. */
  recentMilitaryDischarge: boolean;
  /** Country-specific answers, namespaced by the pack that asked for them. */
  extra: Record<string, string | number | boolean>;
}

export type NumericField = "ageYears" | "dependents" | "dependentsUnder6" | "migrantYears";
export type BooleanField =
  | "hasDisability"
  | "partnered"
  | "militaryReserve"
  | "recentMilitaryDischarge";
export type EnumField = "employment" | "housing" | "incomeBand";

// ---------------------------------------------------------------------------
// The predicate language
// ---------------------------------------------------------------------------

/**
 * A closed, total, side-effect-free expression language. Closed on purpose:
 * because a predicate is data and not a function, a pack can be authored by a
 * non-engineer, reviewed in a diff, serialised to JSON, shipped without a
 * deploy, and — the part that actually matters at scale — **validated**. An
 * arbitrary function cannot be checked for sanity before it runs against a
 * real person's eligibility.
 */
export type Predicate =
  | { kind: "always" }
  | { kind: "never" }
  | { kind: "all"; of: Predicate[] }
  | { kind: "any"; of: Predicate[] }
  | { kind: "not"; of: Predicate }
  /** Numeric comparison. Both bounds inclusive; a missing field never matches. */
  | { kind: "num"; field: NumericField; gte?: number; lte?: number }
  | { kind: "bool"; field: BooleanField; is: boolean }
  | { kind: "enum"; field: EnumField; in: string[] }
  /** Country-specific answer collected by this pack. */
  | { kind: "extra"; key: string; equals: string | number | boolean }
  | { kind: "extraBool"; key: string; is: boolean };

// Small constructors. Packs read as law, not as JSON.
export const always: Predicate = { kind: "always" };
export const never: Predicate = { kind: "never" };
export const all = (...of: Predicate[]): Predicate => ({ kind: "all", of });
export const any = (...of: Predicate[]): Predicate => ({ kind: "any", of });
export const not = (of: Predicate): Predicate => ({ kind: "not", of });
export const num = (field: NumericField, bounds: { gte?: number; lte?: number }): Predicate => ({
  kind: "num",
  field,
  ...bounds,
});
export const is = (field: BooleanField, value = true): Predicate => ({
  kind: "bool",
  field,
  is: value,
});
export const oneOf = (field: EnumField, ...values: string[]): Predicate => ({
  kind: "enum",
  field,
  in: values,
});
export const extraIs = (key: string, value: boolean): Predicate => ({
  kind: "extraBool",
  key,
  is: value,
});

// ---------------------------------------------------------------------------
// Fulfilment
// ---------------------------------------------------------------------------

/**
 * How Zakai actually gets the money — never a link to somebody else's website.
 * Mirrors `src/lib/rightsActions.ts`, restated here so a pack is
 * self-describing and does not depend on the Israeli module.
 */
export type ActionKind = "tool" | "letter" | "agent";

export interface PackAction {
  kind: ActionKind;
  /** Internal route for `tool` actions. An external URL is a schema error. */
  tool?: string;
  /** Key into the pack's own `recipients` table. */
  recipient?: string;
  /** Extra inputs the draft needs, asked in-app. */
  fields?: string[];
  /** Document subject and body, written in the pack's `docLocale`. */
  subject?: string;
  body?: string;
}

// ---------------------------------------------------------------------------
// A right, and a jurisdiction pack
// ---------------------------------------------------------------------------

/**
 * Categories are shared across jurisdictions so the UI, the analytics and the
 * outcome ledger stay comparable between countries. A pack that needs a
 * category not on this list is a signal to extend the list deliberately, not
 * to invent a local one.
 */
export type RightCategory =
  | "tax"
  | "social_security"
  | "municipal"
  | "banking"
  | "consumer"
  | "health"
  | "work"
  | "transport"
  | "education"
  | "military"
  | "family"
  | "senior"
  | "housing"
  | "energy";

export interface RightDef {
  /** Unique within the pack. Prefixed with the market code when reported. */
  id: string;
  category: RightCategory;
  /** Eligibility, as data. */
  when: Predicate;
  /** Conservative recurring value, in the market's minor units. */
  yearlyMinor?: number;
  /** Conservative one-off value, in the market's minor units. */
  oneTimeMinor?: number;
  /**
   * The statute, regulation or directive this rests on. Required. A right
   * without a citation cannot be reviewed by an outside contributor, defended
   * to a regulator, or trusted by the person relying on it.
   */
  source: string;
  action: PackAction;
}

export interface JurisdictionPack {
  /** ISO 3166-1 alpha-2. */
  market: string;
  /** Pack version; bump on any rule change so outcomes stay attributable. */
  version: string;
  /** ISO date the pack was last checked against the law. */
  reviewed: string;
  /** Language official correspondence must be written in (BCP-47). */
  docLocale: string;
  currency: string;
  /** Minor units per major unit — 100 for ILS/GBP/EUR, 1 for JPY. */
  minorUnits: number;
  /** Address blocks, in `docLocale`. Keyed by `PackAction.recipient`. */
  recipients: Record<string, string>;
  rights: RightDef[];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface RightMatch {
  /** Globally unique: `IL:work_grant`. What the outcome ledger keys on. */
  key: string;
  market: string;
  right: RightDef;
}

export interface EvaluationResult {
  market: string;
  currency: string;
  minorUnits: number;
  matches: RightMatch[];
  /** Sum of the honestly quantifiable recurring values only, in minor units. */
  quantifiedYearlyMinor: number;
  byCategory: Map<RightCategory, RightMatch[]>;
}
