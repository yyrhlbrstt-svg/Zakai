import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { runAutopilotJob } from "@/lib/autopilot/runner";
import { jobById, type AutopilotJobId } from "@/lib/autopilot/types";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "law-watcher",
  "price-sentinel",
  "outcome-learner",
  "growth-bot",
  "market-expander",
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ job: string }> },
) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const { job } = await context.params;
  if (!ALLOWED.has(job) || !jobById(job)) {
    return NextResponse.json({ error: "unknown_job" }, { status: 400 });
  }

  try {
    const result = await runAutopilotJob(job as AutopilotJobId);
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    await reportError(err, { route: `cron/autopilot/${job}` });
    return NextResponse.json({ ok: false, error: "job_failed" }, { status: 500 });
  }
}
