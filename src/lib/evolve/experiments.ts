/**
 * The live experiment registry — the actual list of things the product is
 * allowed to change about itself.
 *
 * This file is the boundary made concrete. Everything in it is a real decision
 * the app makes today; nothing is hypothetical. And the `humanOnly` entries are
 * here on purpose rather than simply omitted: an explicit "the machine may not
 * touch this, and here is why" is auditable, whereas an absence is just
 * something nobody got round to.
 */

import type { Experiment } from "./types";

/** Which door the homepage leads with. */
export type DoorOrder = readonly string[];

const CONVERSION = { key: "door_to_case" } as const;
/** Bounce is a metric where lower is better — the engine has to be told. */
const BOUNCE = { key: "bounce_rate", lowerIsBetter: true } as const;

export const EXPERIMENTS: Experiment<unknown>[] = [
  /**
   * Which problem to lead with.
   *
   * The honest reason this is the first live experiment: nobody knows the
   * answer. The current order — money, cancel, owed, electricity — is the order
   * the doors happened to be built in, which is the worst possible basis for
   * the most valuable pixel on the site. It has a clean outcome (did this
   * visitor open a case) and a trivial rollback (reorder an array).
   */
  {
    id: "home_door_order",
    surface: "ranking",
    target: CONVERSION,
    guardrails: [{ metric: BOUNCE, maxRelativeDrop: 0.05 }],
    minSamplesPerArm: 200,
    minRelativeLift: 0.05,
    arms: [
      // The baseline carries a deposit door now. Every arm before this one was
      // four recurring-bill doors and not one recovery of money somebody is
      // already owed — so the experiment could compare orderings of the same
      // idea, and never test the other idea at all.
      { id: "money_first", baseline: true, payload: ["money", "deposit", "cancel", "owed"] },
      // These two carry the deposit door in place of electricity. The arms
      // below each exist to test one specific door in the lead and are left
      // alone; these two do not, and with the bandit rotating seven arms a
      // door present in only one of them is a door most visitors never see.
      // Electricity keeps its page, its catalogue entry and its place in the
      // grid below the fold — it is ₪45 a month, the smallest door in the set.
      { id: "owed_first", payload: ["owed", "money", "deposit", "cancel"] },
      { id: "cancel_first", payload: ["cancel", "money", "deposit", "owed"] },
      // "dormant" and "incident" were added to the homepage's door grid with a
      // comment calling them "the two strongest reasons to open the app" — but
      // no arm here ever placed either first, so `rank()` in page.tsx sorted
      // them last regardless of which arm won, on every single run. A
      // self-improving system cannot learn that a door converts well if no arm
      // ever tests it in a winning position; it was structurally blind to
      // exactly the two doors this file's own sibling comment argued for.
      { id: "dormant_first", payload: ["dormant", "money", "cancel", "owed"] },
      { id: "incident_first", payload: ["incident", "money", "cancel", "owed"] },
      // The only door that prevents a loss instead of recovering one, and the
      // largest single sum on the page — added to the grid with that argument
      // in its own comment, and just as untested in a leading position as the
      // two above until now.
      { id: "vehicle_check_first", payload: ["vehicle-check", "money", "cancel", "owed"] },
      // The largest single sum a consumer here is routinely owed, and the one
      // where the fee is 18% of the whole recovery rather than of one month.
      // Untested in a leading position for the same reason as the three above:
      // no arm ever placed it there.
      { id: "deposit_first", payload: ["deposit", "money", "cancel", "owed"] },
      // Electricity moved out of the two general arms to make room for the
      // deposit door, which would have left it in no arm at all — sorted last
      // on every run and untestable in any position, the exact failure this
      // experiment's own comments describe happening to dormant and incident.
      // It gets its own lead arm instead, like they did.
      { id: "electricity_first", payload: ["electricity", "money", "cancel", "owed"] },
    ],
  },

  /**
   * When to ask for an account.
   *
   * Asking earlier captures more contact details; asking later gets more
   * people to the point where there is something worth saving. Which wins is
   * an empirical question that teams argue about for months.
   */
  {
    id: "signup_moment",
    surface: "timing",
    target: { key: "reached_first_value" },
    guardrails: [{ metric: { key: "account_creation_rate" }, maxRelativeDrop: 0.15 }],
    minSamplesPerArm: 150,
    minRelativeLift: 0.05,
    arms: [
      { id: "after_result", baseline: true, payload: "after_result" },
      { id: "before_scan", payload: "before_scan" },
      { id: "never_until_send", payload: "never_until_send" },
    ],
  },

  /**
   * How long to wait before the agent chases a counterparty that has not
   * replied. Too fast reads as harassment and gets ignored; too slow and the
   * customer assumes nothing is happening.
   */
  {
    id: "followup_delay_days",
    surface: "timing",
    target: { key: "reply_received" },
    guardrails: [{ metric: { key: "complaint_rate", lowerIsBetter: true }, maxRelativeDrop: 0.02 }],
    minSamplesPerArm: 100,
    minRelativeLift: 0.08,
    arms: [
      { id: "d14", baseline: true, payload: 14 },
      { id: "d7", payload: 7 },
      { id: "d21", payload: 21 },
    ],
  },

  // -------------------------------------------------------------------------
  // Declared, and permanently off-limits.
  // -------------------------------------------------------------------------

  /**
   * An optimiser pointed at the success fee would discover, correctly and
   * quickly, that charging more earns more. That is not an improvement to this
   * product — it is a different company, and not one worth building. The rate
   * is the promise the whole thing rests on.
   */
  {
    id: "success_fee_rate",
    surface: "threshold",
    target: { key: "revenue_per_case" },
    guardrails: [],
    humanOnly: true,
    minSamplesPerArm: Number.MAX_SAFE_INTEGER,
    minRelativeLift: 1,
    arms: [{ id: "eighteen_percent", baseline: true, payload: 1800 }],
  },

  /**
   * Consent wording decides whether permission was informed. Optimising it for
   * agreement rate is optimising for people not reading it, which is the
   * definition of consent that is not consent.
   */
  {
    id: "consent_copy",
    surface: "wording",
    target: { key: "consent_accept_rate" },
    guardrails: [],
    humanOnly: true,
    minSamplesPerArm: Number.MAX_SAFE_INTEGER,
    minRelativeLift: 1,
    arms: [{ id: "reviewed_text", baseline: true, payload: "terms_privacy_v1" }],
  },

  /**
   * Rate limits, OTP attempt caps and token lifetimes. A system tuning its own
   * security thresholds against a conversion metric will loosen them, because
   * loosening them always converts better right up until it doesn't.
   */
  {
    id: "security_thresholds",
    surface: "threshold",
    target: { key: "flow_completion" },
    guardrails: [],
    humanOnly: true,
    minSamplesPerArm: Number.MAX_SAFE_INTEGER,
    minRelativeLift: 1,
    arms: [{ id: "current", baseline: true, payload: "as_configured" }],
  },
];

export function experimentById(id: string): Experiment<unknown> | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}

/** Only the experiments the engine may actually act on. */
export function automatableExperiments(): Experiment<unknown>[] {
  return EXPERIMENTS.filter((e) => !e.humanOnly);
}
