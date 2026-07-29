import { NextResponse } from "next/server";
import { runEvolutionCycle } from "@/lib/evolve/store";
import { assessOracleCalibration } from "@/lib/oracle/store";
import { reportError } from "@/lib/report-error";
import { secretsMatch } from "@/lib/security/timingSafe";

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
  if (secret && !secretsMatch(request.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runEvolutionCycle();
    for (const line of result.digest) console.log("[evolve]", line);

    // Grade the Oracle on claims it could not have seen, every day.
    // Calibration decays on its own — counterparties change policy and the
    // Strategy Engine changes what we send — and a model whose probabilities
    // have quietly stopped meaning what they say is worse than no model, because
    // people are still multiplying them by money.
    const calibration = await assessOracleCalibration();
    console.log("[oracle]", calibration.verdict, "—", calibration.summary);

    return NextResponse.json({
      ok: true,
      promoted: result.promoted,
      digest: result.digest,
      reviewed: result.reviews.length,
      oracle: {
        verdict: calibration.verdict,
        samples: calibration.samples,
        ece: Number(calibration.ece.toFixed(4)),
        skill: Number(calibration.skill.toFixed(4)),
        summary: calibration.summary,
      },
    });
  } catch (err) {
    await reportError(err, { route: "cron/evolve" });
    // A failed cycle must never look like a successful one: a silent failure
    // here means the product stops improving while reporting that it is.
    return NextResponse.json({ ok: false, error: "cycle_failed" }, { status: 500 });
  }
}
