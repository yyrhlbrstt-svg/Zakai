import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { processOutboxBatch } from "@/lib/workers/outboxDeliver";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

/**
 * Outbox worker — drains QUEUED/FAILED messages when SMTP/SMS is configured.
 * Ideally every 1–5 minutes when OUTBOX_ASYNC=true; vercel.json currently
 * schedules it once daily (Hobby-plan cron limit — see that file). If you
 * flip OUTBOX_ASYNC=true expecting near-real-time delivery, know that a
 * queued ownership OTP/magic link, fee confirmation, or provider letter can
 * sit QUEUED for up to ~24h with nothing else to drain it sooner; hit this
 * route manually (with CRON_SECRET) or upgrade the Vercel plan if that gap
 * matters for your deployment.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await processOutboxBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await reportError(err, { route: "cron/outbox" });
    return NextResponse.json({ ok: false, error: "outbox_worker_failed" }, { status: 500 });
  }
}
