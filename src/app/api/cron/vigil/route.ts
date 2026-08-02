import { NextResponse } from "next/server";
import { runVigil } from "@/lib/vigil/run";
import { reportError } from "@/lib/report-error";
import { requireCronAuth } from "@/lib/security/cronAuth";

export const dynamic = "force-dynamic";

/**
 * The daily watch.
 *
 * Runs at 07:00, which is a decision rather than a default: a notification
 * about money is read in the morning and resented at night. The job itself is
 * cheap — the restraint is in `runVigil`, which will send at most one thing to
 * at most one person per fortnight, and nothing at all about a deadline that
 * has already passed.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await runVigil();
    console.log("[vigil]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await reportError(err, { route: "cron/vigil" });
    return NextResponse.json({ ok: false, error: "run_failed" }, { status: 500 });
  }
}
