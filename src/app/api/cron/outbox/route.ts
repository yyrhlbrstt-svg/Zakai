import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { processOutboxBatch } from "@/lib/workers/outboxDeliver";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

/**
 * Outbox worker — drains QUEUED/FAILED messages when SMTP/SMS is configured.
 * Schedule every 1–5 minutes in production when OUTBOX_ASYNC=true.
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
