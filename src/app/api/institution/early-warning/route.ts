import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  MIN_PATTERN_SAMPLE,
  PATTERN_MIN_SHARE,
  buildEarlyWarning,
  worthWarning,
  type ClaimRow,
} from "@/lib/institutionEarlyWarning";
import {
  aggregateInboundPressure,
  disclosedInboundPressure,
  pressureRowsFromCases,
  CASE_PRESSURE_SELECT,
} from "@/lib/institutionInboundPressure";
import { prismaRead } from "@/lib/prismaRead";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": cacheControlHeader("live_aggregate"),
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const q = z.object({ institution: z.string().min(1).max(80) });

/**
 * What is going wrong inside an institution, told to them before a regulator
 * finds it.
 *
 * An institution's worst outcome is not a complaint; it is a systemic fault
 * discovered after it has already hit tens of thousands of customers, because
 * remediation is then mandated across all of them. They miss those faults for
 * a structural reason: complaint systems handle complaints one at a time, by
 * design, and nobody looks across them. Zakai sits across many customers of
 * the same counterparty with documented outcomes — precisely the view their
 * own process cannot produce.
 *
 * THE LINE THIS DOES NOT CROSS
 *
 * This buys time to fix, never silence. The regulatory snapshot publishes
 * regardless, nothing here is conditional on payment or on a claim being
 * dropped, and consumers are refunded either way. It reports the existence and
 * shape of a pattern — never an offer to suppress one.
 *
 * WHY ONLY DISCLOSED INSTITUTIONS
 *
 * Same gate as /api/institution/ignore-cost. Serving a named systemic-fault
 * finding about any company anyone can type would be publishing an accusation
 * to a stranger; an institution that has disclosed an inbound endpoint has
 * asked to be in this conversation. The aggregate that goes to regulators is
 * the snapshot, and it is subject to its own thresholds.
 *
 * SOURCED FROM THE DE-IDENTIFIED TABLE
 *
 * StrategyOutcome carries no User or Case FK by rule, so a warning cannot
 * carry a claimant even by accident — and documented outcomes only, because a
 * self-report is somebody's memory and this names a company.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("early-warning", ip, 40, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const url = new URL(request.url);
  const parsed = q.safeParse({ institution: url.searchParams.get("institution") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: CORS });
  }
  const key = parsed.data.institution.trim().toLowerCase();

  try {
    const cases = await prismaRead.case.findMany({
      where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
      select: CASE_PRESSURE_SELECT,
    });
    const disclosed = disclosedInboundPressure(
      aggregateInboundPressure(pressureRowsFromCases(cases)),
    );
    if (!disclosed.some((p) => p.institutionId.toLowerCase() === key)) {
      return NextResponse.json(
        {
          ok: true,
          institution: parsed.data.institution,
          disclosed: false,
          warning: null,
          note: "Early warnings are available to institutions that have disclosed an inbound Mandate endpoint.",
        },
        { headers: CORS },
      );
    }

    const outcomes = await prismaRead.strategyOutcome.findMany({
      where: { counterparty: key, selfReported: false },
      select: { vertical: true, paid: true, recoveredMinor: true, days: true },
    });

    const claims: ClaimRow[] = outcomes.map((o) => ({
      // The rule-pack key is the normalised cause. Never free text: a cause
      // taken from what somebody typed would let a claimant's words end up in
      // a finding about a company.
      cause: o.vertical,
      paid: o.paid,
      recoveredMinor: o.recoveredMinor,
      days: o.days,
    }));

    const warning = buildEarlyWarning(key, claims);

    return NextResponse.json(
      {
        ok: true,
        institution: parsed.data.institution,
        disclosed: true,
        thresholds: {
          min_claims_per_cause: MIN_PATTERN_SAMPLE,
          min_share_of_claims: PATTERN_MIN_SHARE,
        },
        total_claims: warning.totalClaims,
        // Stated, never hidden: a reader has to be able to tell "nothing is
        // wrong" from "we cannot see enough yet".
        reason: warning.reason,
        /**
         * Whether we would actually send this. A warning about a cause the
         * institution rarely concedes is a disagreement, not a fault, and
         * sending it as one spends the credibility that makes the next
         * warning land.
         */
        actionable: worthWarning(warning),
        headline: warning.headline,
        patterns: warning.patterns,
        links: {
          regulatory_snapshot: "/api/regulatory/snapshot?market=IL",
          inbound_pressure: "/api/institution/inbound-pressure",
        },
        note: "Time to fix, not silence — the regulatory snapshot publishes regardless, and consumers are refunded either way.",
      },
      { headers: CORS },
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: CORS });
  }
}
