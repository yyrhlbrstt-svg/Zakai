import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COLLECTIVE_VERTICALS } from "@/lib/collective/verticals";

export const runtime = "nodejs";
export const revalidate = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=120",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") ?? "IL").toUpperCase();

  const rows = await prisma.collectiveIntentSignal
    .groupBy({
      by: ["vertical"],
      where: { market },
      _count: { _all: true },
    })
    .catch(() => [] as { vertical: string; _count: { _all: number } }[]);

  const byVertical = Object.fromEntries(
    COLLECTIVE_VERTICALS.map((v) => [v, rows.find((r) => r.vertical === v)?._count._all ?? 0]),
  );
  const total = Object.values(byVertical).reduce((s, n) => s + n, 0);

  return NextResponse.json(
    {
      market,
      total_signals: total,
      by_vertical: byVertical,
      phase: "intent_only",
      disclaimer:
        "Counts are anonymous signals — not verified buyers or auction participants.",
      signal_endpoint: "/api/collective/intent",
    },
    { headers: CORS },
  );
}
