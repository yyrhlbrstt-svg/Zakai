import { NextResponse } from "next/server";
import { z } from "zod";
import { predict } from "@/lib/oracle/store";
import { assessOracleCalibration } from "@/lib/oracle/store";
import { rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { secretsMatch } from "@/lib/security/timingSafe";
import { resolveOracleKey } from "@/lib/oracle/keys";

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
 *
 * Auth: a per-customer key from OracleKey (mint one at POST /api/oracle/keys,
 * admin-only), or the legacy single-tenant ORACLE_API_KEY env var.
 */
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const masterKey = process.env.ORACLE_API_KEY;

  // No credential presented and no master key configured at all means the
  // endpoint is closed, not open. A pricing API that defaults to public
  // because someone forgot an environment variable is a data leak with a
  // countdown on it. (Per-customer OracleKey rows can still make the
  // endpoint reachable with zero env config — that's the point of them.)
  if (!key && !masterKey) {
    return NextResponse.json({ error: "not_enabled" }, { status: 503 });
  }

  // ORACLE_API_KEY remains a "master" key for backward compatibility, but
  // the real multi-tenant path is a per-customer OracleKey: one shared
  // secret can't be sold to more than one paying institution at a time —
  // there's no way to revoke customer A without breaking customer B, and no
  // way to see whose traffic is whose. Hashed comparison first so a length
  // mismatch takes the same path as a content mismatch (a timing oracle on
  // the key's length otherwise).
  let identity = "master";
  if (!masterKey || !secretsMatch(key, masterKey)) {
    const resolved = await resolveOracleKey(key || null);
    if (!resolved) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    identity = `key:${resolved.label}`;
  }

  // Rate-limited by resolved customer identity, not raw IP — the correct
  // axis for a server-to-server B2B API, where one customer's traffic can
  // legitimately share an exit IP with other callers, and IP alone gives no
  // way to grant one paying customer a larger quota than another.
  const limited = await rateLimit("oracle_predict", identity, 600, 60);
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
