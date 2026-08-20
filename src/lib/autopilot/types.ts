/**
 * Autopilot job identifiers — self-updating system engines.
 * Schedules are documented for Vercel crons; enforcement uses AutopilotRun timestamps.
 */

export type AutopilotJobId =
  | "law-watcher"
  | "price-sentinel"
  | "outcome-learner"
  | "growth-bot"
  | "market-expander"
  | "concentration-watcher"
  | "response-clock";

export interface AutopilotJobDef {
  id: AutopilotJobId;
  title: string;
  summary: string;
  /** Minimum ms between runs when using runDueJobs */
  intervalMs: number;
  /** Vercel cron hint (documentation) */
  cronHint: string;
  humanGate: string;
}

export const AUTOPILOT_JOBS: readonly AutopilotJobDef[] = [
  {
    id: "law-watcher",
    title: "Law Watcher",
    summary: "Hash official source URLs cited in packs; open maintainer tasks on change.",
    // Daily on Vercel Hobby (sub-daily schedules are Pro-only).
    intervalMs: 24 * 60 * 60 * 1000,
    cronHint: "0 4 * * *",
    humanGate: "ZML pack PRs require maintainer merge — no auto-publish of legal text.",
  },
  {
    id: "price-sentinel",
    title: "Price Sentinel",
    summary: "Compare configured public price pages to last snapshot; queue Vigil-style alerts.",
    intervalMs: 24 * 60 * 60 * 1000,
    cronHint: "0 4 * * *",
    humanGate: "Notifies users of public price changes — does not negotiate with providers.",
  },
  {
    id: "outcome-learner",
    title: "Outcome Learner",
    summary: "Aggregate StrategyOutcome + evolve experiments; promote/rollback templates.",
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    cronHint: "0 3 * * 0",
    humanGate: "Uses de-identified outcomes only; evolve guardrails block reckless promotion.",
  },
  {
    id: "growth-bot",
    title: "Growth Bot",
    summary: "Suggest topics from outcome data — no auto-post without social API credentials.",
    intervalMs: 24 * 60 * 60 * 1000,
    cronHint: "0 8 * * *",
    humanGate: "Does not DM users or spam; exports digest for founder when APIs absent.",
  },
  {
    id: "market-expander",
    title: "Market Expander",
    summary: "Detect demand without packs; file maintainer onboarding tasks.",
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    cronHint: "0 2 * * 1",
    humanGate: "Pack templates need local legal citations — community maintainer required.",
  },
  {
    id: "concentration-watcher",
    title: "Concentration Watcher",
    summary:
      "Nightly statute-concentration report over active cases (constraint 12); alerts on breach of the configured share ceiling.",
    intervalMs: 24 * 60 * 60 * 1000,
    cronHint: "0 5 * * *",
    humanGate:
      "Reports and alerts only — diversifying the Rights Graph is a roadmap decision a human makes.",
  },
  {
    id: "response-clock",
    title: "Response Clock",
    summary:
      "Nightly deadline clocks over SENT cases: which response windows closed, and which escalation rung is due next (Phase 2 deadline clocks).",
    intervalMs: 24 * 60 * 60 * 1000,
    cronHint: "0 6 * * *",
    humanGate:
      "Clocks and reports only — every escalation artifact still requires the person's explicit action on their own case.",
  },
] as const;

export function jobById(id: string): AutopilotJobDef | undefined {
  return AUTOPILOT_JOBS.find((j) => j.id === id);
}
