import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAutopilotManifest } from "@/lib/autopilot/runner";
import { AUTOPILOT_JOBS } from "@/lib/autopilot/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const manifest = buildAutopilotManifest(origin);

  const lastRuns = await Promise.all(
    AUTOPILOT_JOBS.map(async (j) => {
      const row = await prisma.autopilotRun.findFirst({
        where: { jobId: j.id },
        orderBy: { createdAt: "desc" },
        select: { ok: true, summary: true, createdAt: true },
      });
      return { jobId: j.id, last: row };
    }),
  ).catch(() => AUTOPILOT_JOBS.map((j) => ({ jobId: j.id, last: null })));

  return NextResponse.json(
    { ...manifest, last_runs: lastRuns },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
