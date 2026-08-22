/**
 * Feature flags, the cheapest version that is still honest.
 *
 * WHY NOT A SERVICE
 *
 * A paid flag service bills per seat and per monthly active user to solve a
 * problem this product does not have yet: no two people need to see different
 * variants, and nobody is running an experiment. What it DOES need is the
 * ability to merge a risky change without it becoming live at the same moment
 * — which is an environment variable and a deliberate flip, not a platform.
 *
 * WHY DEFAULTS ARE `false`
 *
 * A flag that defaults on is not a flag, it is a slower deploy. Every flag
 * here is off unless the environment says otherwise, so merging is safe by
 * construction and turning something on is an act somebody performs on
 * purpose, at a time they chose, and can undo in seconds without a revert.
 *
 * WHY THE SET IS CLOSED
 *
 * Free-text flag names rot the same way free-text event types do: within a
 * year nobody knows which are live, which are dead, and which were typos that
 * silently read as `false` forever. A typo here is a type error.
 *
 * READ AT CALL TIME, NOT AT MODULE LOAD
 *
 * Vercel Edge Config and env changes take effect on the next invocation. A
 * module-level constant would freeze the value at cold start, so a flag flip
 * would appear to do nothing until the lambda recycled — the exact confusion a
 * flag exists to avoid.
 */

export const FLAGS = {
  /**
   * Route case progression through the Inngest durable workflow instead of
   * the existing cron + database-state path.
   *
   * Off by default and deliberately so: the cron path is what production runs
   * today, and two orchestrators over the same Case rows is how a letter gets
   * sent twice. See `src/lib/workflow/caseWorkflow.ts`.
   */
  durableCaseWorkflow: "ZAKAI_FLAG_DURABLE_CASE_WORKFLOW",
  /** Show the Open Banking link-account entry point on the money hub. */
  openBankingEntry: "ZAKAI_FLAG_OPEN_BANKING_ENTRY",
  /** Report client and server errors to Sentry. Needs SENTRY_DSN as well. */
  errorReporting: "ZAKAI_FLAG_ERROR_REPORTING",
} as const;

export type FlagName = keyof typeof FLAGS;

/** Anything other than an explicit truthy string is off. */
function truthy(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * Is this flag on right now?
 *
 * Reads `process.env` because that is what both Vercel env vars and Edge
 * Config-backed values surface as at runtime. Kept as a single function so
 * that when Edge Config does arrive, exactly one place changes.
 */
export function flagEnabled(name: FlagName): boolean {
  return truthy(process.env[FLAGS[name]]);
}

/** Every flag and its state — for /founder and the pre-demo checklist. */
export function allFlags(): Array<{ name: FlagName; env: string; on: boolean }> {
  return (Object.keys(FLAGS) as FlagName[]).map((name) => ({
    name,
    env: FLAGS[name],
    on: flagEnabled(name),
  }));
}
