import { NextResponse } from "next/server";
import { runEvolutionCycle } from "@/lib/evolve/store";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

/**
 * The self-improvement cycle. Runs daily, and nobody approves what it decides.
 *
 * That is the whole point and also the whole risk, so the safety lives one
 * layer down: `review()` will not conclude anything without enough data, an
 * intact guardrail, an effect large enough to be worth having, and posteriors
 * that have genuinely separated. Permission to act without asking is bought by
 * being hard to convince.
 *
 * The digest is returned rather than only logged so a human can read, in one
 * screen, every change the machine made to the product and the evidence for
 * it. A system that rewrites the product without producing that account is one
 * nobody can supervise — and the first time it surprises someone it gets
 * turned off for good.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runEvolutionCycle();
    for (const line of result.digest) console.log("[evolve]", line);
    return NextResponse.json({
      ok: true,
      promoted: result.promoted,
      digest: result.digest,
      reviewed: result.reviews.length,
    });
  } catch (err) {
    await reportError(err, { route: "cron/evolve" });
    // A failed cycle must never look like a successful one: a silent failure
    // here means the product stops improving while reporting that it is.
    return NextResponse.json({ ok: false, error: "cycle_failed" }, { status: 500 });
  }
}
