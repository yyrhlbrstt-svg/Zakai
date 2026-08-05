import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTOPILOT_JOBS, jobById, type AutopilotJobId } from "./types";
import { runLawWatcher } from "./jobs/lawWatcherJob";
import { runPriceSentinel } from "./jobs/priceSentinelJob";
import { runOutcomeLearner } from "./jobs/outcomeLearnerJob";
import { runGrowthBot } from "./jobs/growthBotJob";
import { runMarketExpander } from "./jobs/marketExpanderJob";
import type { AutopilotJobResult } from "./findings";

const RUNNERS: Record<AutopilotJobId, () => Promise<AutopilotJobResult>> = {
  "law-watcher": runLawWatcher,
  "price-sentinel": runPriceSentinel,
  "outcome-learner": runOutcomeLearner,
  "growth-bot": runGrowthBot,
  "market-expander": runMarketExpander,
};

export async function runAutopilotJob(id: AutopilotJobId): Promise<AutopilotJobResult> {
  const def = jobById(id);
  if (!def) throw new Error(`unknown_job:${id}`);
  const result = await RUNNERS[id]();
  await prisma.autopilotRun.create({
    data: {
      jobId: id,
      ok: result.ok,
      summary: result.summary,
      findings: result.findings as Prisma.InputJsonValue,
    },
  });
  return result;
}

export async function runDueAutopilotJobs(now = Date.now()): Promise<
  Array<{ jobId: AutopilotJobId; skipped?: boolean; result?: AutopilotJobResult }>
> {
  const out: Array<{ jobId: AutopilotJobId; skipped?: boolean; result?: AutopilotJobResult }> = [];

  for (const job of AUTOPILOT_JOBS) {
    const last = await prisma.autopilotRun.findFirst({
      where: { jobId: job.id },
      orderBy: { createdAt: "desc" },
    });
    const elapsed = last ? now - last.createdAt.getTime() : Infinity;
    if (elapsed < job.intervalMs) {
      out.push({ jobId: job.id, skipped: true });
      continue;
    }
    const result = await runAutopilotJob(job.id);
    out.push({ jobId: job.id, result });
  }

  return out;
}

export function buildAutopilotManifest(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: "zakai-autopilot",
    version: "2026-08-03",
    tagline: "Self-updating loops with human gates on law and money.",
    jobs: AUTOPILOT_JOBS,
    cron: `${base}/api/cron/autopilot`,
    cron_single: `${base}/api/cron/autopilot?job=law-watcher`,
    status: `${base}/api/autopilot/status`,
    env: {
      law_watcher: "GITHUB_TOKEN + AUTOPILOT_GITHUB_REPO for issues",
      price_sentinel: "AUTOPILOT_PRICE_FEEDS_JSON",
      growth_bot: "TIKTOK_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN (optional)",
    },
    rules: [
      "No automatic merge of ZML legal text.",
      "No outbound payment or provider API calls.",
      "StrategyOutcome and experiments stay de-identified.",
      "Evolve promotions require statistical guardrails.",
    ],
  };
}
