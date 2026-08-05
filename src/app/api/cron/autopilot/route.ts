import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { runDueAutopilotJobs } from "@/lib/autopilot/runner";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

/** Runs autopilot jobs whose interval has elapsed since last run. */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const results = await runDueAutopilotJobs();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    await reportError(err, { route: "cron/autopilot" });
    return NextResponse.json({ ok: false, error: "autopilot_failed" }, { status: 500 });
  }
}
