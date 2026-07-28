import { NextResponse } from "next/server";
import { z } from "zod";
import { recordTrial } from "@/lib/evolve/store";
import { experimentById } from "@/lib/evolve/experiments";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  experimentId: z.string().min(1).max(64),
  armId: z.string().min(1).max(64),
  converted: z.boolean(),
  value: z.number().finite().optional(),
  guardrails: z.record(z.number().finite()).optional(),
});

/**
 * Where the product reports what happened.
 *
 * Unauthenticated on purpose: most of what is worth measuring happens before
 * anyone has an account, and an experiment that can only see logged-in
 * visitors would optimise the product for the people who already converted.
 *
 * That openness is why the payload is checked hard. Only declared experiments
 * and declared arms are accepted, so a caller cannot invent a bucket and
 * poison the evidence base; and human-only experiments are rejected outright,
 * because an endpoint that quietly accepted trials for the fee rate would be a
 * way around the boundary the whole design rests on.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("evolve_trial", clientIp(request), 120, 600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const experiment = experimentById(parsed.data.experimentId);
  if (!experiment) return NextResponse.json({ error: "unknown_experiment" }, { status: 400 });
  if (experiment.humanOnly) {
    return NextResponse.json({ error: "not_automatable" }, { status: 403 });
  }
  if (!experiment.arms.some((a) => a.id === parsed.data.armId)) {
    return NextResponse.json({ error: "unknown_arm" }, { status: 400 });
  }

  await recordTrial(parsed.data);
  return NextResponse.json({ ok: true });
}
