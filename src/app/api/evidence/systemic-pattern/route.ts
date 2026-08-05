import { NextResponse } from "next/server";
import { z } from "zod";
import { secretsMatch } from "@/lib/security/timingSafe";
import { resolveEvidenceKey } from "@/lib/evidence/keys";
import { rateLimit } from "@/lib/ratelimit";
import { loadSystemicPatternReport } from "@/lib/services/systemicPatternEvidence";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  market: z.string().length(2),
  provider: z.string().min(1).max(64),
});

/**
 * Licensed evidence API — aggregated, de-identified, sample-gated settlement
 * facts against one named provider, sold to plaintiff firms building a
 * systemic-pattern filing and to regulators building their own case file.
 * Same asset as the Oracle (StrategyOutcome), a different buyer and a
 * different question: not "will this claim pay" but "what did documented
 * settlements against this provider actually look like."
 *
 * LEGAL DISCIPLINE, not a formality: this reports neutral facts under the
 * same MIN_SAMPLE gate every other provider-facing aggregate in this
 * codebase uses (src/lib/companyScore.ts) and states no legal conclusion.
 * "documented settlement pattern" is not "evidence of wrongdoing" and the
 * response says so explicitly — a caller who strips that framing off before
 * filing it somewhere is doing something this API never claimed to support.
 *
 * Auth: a per-customer key from EvidenceKey (mint via POST /api/evidence/keys,
 * admin-only), or the EVIDENCE_API_KEY env var as a master key.
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

  const limited = await rateLimit("evidence_systemic_pattern", identity, 120, 60);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  try {
    const report = await loadSystemicPatternReport(
      parsed.data.market.toUpperCase(),
      parsed.data.provider,
    );

    if (!report) {
      return NextResponse.json({
        provider: parsed.data.provider,
        market: parsed.data.market.toUpperCase(),
        available: false,
        reason: "insufficient_sample",
        note: "Fewer than the minimum documented, verified outcomes exist for this provider — no report is generated below that threshold, ever.",
      });
    }

    return NextResponse.json({
      provider: parsed.data.provider,
      market: parsed.data.market.toUpperCase(),
      available: true,
      documented_cases: report.documentedCases,
      paid_cases: report.paidCases,
      paid_rate_pct: report.paidRatePct,
      total_recovered_minor: report.totalRecoveredMinor,
      avg_recovered_minor: report.avgRecoveredMinor,
      median_days_to_resolution: report.medianDays,
      first_documented_at: report.firstDocumentedAt,
      last_documented_at: report.lastDocumentedAt,
      legal_note:
        "This is a neutral, aggregated count of documented settlement outcomes. It states no legal conclusion, alleges no wrongdoing, and is not a substitute for the underlying discovery a real filing requires.",
    });
  } catch (err) {
    await reportError(err, { route: "evidence-systemic-pattern" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
