import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { predict } from "@/lib/oracle/store";
import { assessOracleCalibration } from "@/lib/oracle/store";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  market: z.string().length(2),
  vertical: z.string().min(1).max(64),
  counterparty: z.string().min(1).max(64),
  rightId: z.string().max(64).optional(),
});

/**
 * The Oracle, as an API.
 *
 * This is the surface the asset is sold through: an underwriter, insurer or
 * institution asks "will this claim pay, how much, how long" and gets a
 * calibrated answer with the evidence behind it.
 *
 * Two things are returned that a normal prediction API would leave out, and
 * both are the point:
 *
 *   `confident` — false means do not price money against this. A number without
 *   that flag invites a caller to multiply an uncertain probability by a real
 *   amount, which is the failure that ends funding businesses.
 *
 *   `calibration` — how the model has actually been scoring on claims it had
 *   not seen. Anyone can serve a probability; what makes one worth paying for
 *   is a standing, measured claim that it means what it says. Publishing it
 *   alongside every answer means we cannot quietly drift.
 */
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = process.env.ORACLE_API_KEY;

  // No key configured means the endpoint is closed, not open. A pricing API
  // that defaults to public because someone forgot an environment variable is
  // a data leak with a countdown on it.
  if (!expected) {
    return NextResponse.json({ error: "not_enabled" }, { status: 503 });
  }
  const provided = Buffer.from(key);
  const wanted = Buffer.from(expected);
  if (
    provided.length !== wanted.length ||
    !crypto.timingSafeEqual(provided, wanted)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit("oracle_predict", clientIp(request), 600, 60);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  try {
    const [prediction, calibration] = await Promise.all([
      predict({ ...parsed.data, market: parsed.data.market.toUpperCase() }),
      assessOracleCalibration(),
    ]);

    return NextResponse.json({
      paid_probability: Number(prediction.paidProbability.toFixed(4)),
      interval_90: prediction.interval.map((n) => Number(n.toFixed(4))),
      expected_amount_minor: prediction.expectedAmountMinor,
      expected_days: prediction.expectedDays,
      expected_value_minor: prediction.expectedValueMinor,
      evidence: prediction.evidence,
      confident: prediction.confident,
      calibration: {
        verdict: calibration.verdict,
        samples: calibration.samples,
        expected_calibration_error: Number(calibration.ece.toFixed(4)),
        skill_score: Number(calibration.skill.toFixed(4)),
      },
    });
  } catch (err) {
    await reportError(err, { route: "oracle/predict" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
