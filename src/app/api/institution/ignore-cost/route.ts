import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { computeIgnoreCost } from "@/lib/monopoly/ignoreCost";
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

const q = z.object({
  institution: z.string().min(1).max(80).optional(),
});

/**
 * Ops math: cost of ignoring disclosed Mandate inbound (assumptions stated).
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("ignore-cost", ip, 40, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const url = new URL(request.url);
  const parsed = q.safeParse({ institution: url.searchParams.get("institution") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: CORS });
  }

  try {
    const cases = await prismaRead.case.findMany({
      where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
      select: CASE_PRESSURE_SELECT,
    });
    const pressure = disclosedInboundPressure(aggregateInboundPressure(pressureRowsFromCases(cases)));

    if (parsed.data.institution) {
      const key = parsed.data.institution.toLowerCase();
      const row = pressure.find((p) => p.institutionId.toLowerCase() === key);
      if (!row) {
        return NextResponse.json(
          {
            institution: parsed.data.institution,
            found: false,
            cost: computeIgnoreCost({ dispatchedCases: 0, savedCases: 0 }),
            disclaimer: "No disclosed inbound pressure for this id — not a claim of zero real mail.",
          },
          { headers: CORS },
        );
      }
      return NextResponse.json(
        {
          institution: row.institutionId,
          found: true,
          dispatchedCases: row.dispatchedCases,
          savedCases: row.savedCases,
          cost: computeIgnoreCost({
            dispatchedCases: row.dispatchedCases,
            savedCases: row.savedCases,
          }),
          assumptions: {
            minutesPerUnhandled: 8,
            deskAgorotPerHour: 12_000,
          },
          disclaimer:
            "Estimates from disclosed Zakai dispatches only — not total institution inbound volume.",
        },
        { headers: CORS },
      );
    }

    const ranked = pressure.slice(0, 15).map((p) => ({
      institutionId: p.institutionId,
      dispatchedCases: p.dispatchedCases,
      savedCases: p.savedCases,
      cost: computeIgnoreCost({
        dispatchedCases: p.dispatchedCases,
        savedCases: p.savedCases,
      }),
    }));

    return NextResponse.json(
      {
        top: ranked,
        assumptions: { minutesPerUnhandled: 8, deskAgorotPerHour: 12_000 },
        disclaimer:
          "Estimates from disclosed Zakai dispatches only — not total institution inbound volume.",
      },
      { headers: CORS },
    );
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 503, headers: CORS });
  }
}
