import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/security/timingSafe";
import { resolveEvidenceKey } from "@/lib/evidence/keys";
import { rateLimit } from "@/lib/ratelimit";
import { loadInstitutionRiskTrend } from "@/lib/services/institutionRiskTrend";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Second report type under the same licensed evidence API as
 * /api/evidence/systemic-pattern (same EvidenceKey customers — a regulator's
 * own risk team, an institution's own compliance desk): the free
 * /api/institution/inbound-pressure snapshot published as a two-window
 * trend instead of one current count, so a paid consumer sees whether
 * pressure against an institution is accelerating, not just how much
 * exists today. Same auth model as the Oracle/evidence routes: a
 * per-customer EvidenceKey, or the legacy EVIDENCE_API_KEY as a master key.
 */
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const masterKey = process.env.EVIDENCE_API_KEY;

  if (!key && !masterKey) {
    return NextResponse.json({ error: "not_enabled" }, { status: 503 });
  }

  let identity = "master";
  if (!masterKey || !secretsMatch(key, masterKey)) {
    const resolved = await resolveEvidenceKey(key || null);
    if (!resolved) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    identity = `key:${resolved.label}`;
  }

  const limited = await rateLimit("evidence_institution_risk_trend", identity, 120, 60);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    const trends = await loadInstitutionRiskTrend();
    return NextResponse.json({
      ok: true,
      window_days: 30,
      institutions: trends.map((t) => ({
        institution_id: t.institutionId,
        recent_window_cases: t.recentWindowCases,
        prior_window_cases: t.priorWindowCases,
        change_pct: t.changePct,
      })),
      note: "Two-window comparison of documented, de-identified outbound case volume — a level count, not a fitted forecast. change_pct is null (not zero) when the prior window had no cases, since no honest ratio exists against zero.",
    });
  } catch (err) {
    await reportError(err, { route: "evidence-institution-risk-trend" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
