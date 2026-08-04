import { NextRequest, NextResponse } from "next/server";
import { buildInteropDocument, runInteropProbe } from "@/lib/protocol/interop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  };
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const doc = buildInteropDocument(origin);
  const probe = request.nextUrl.searchParams.get("probe") === "1";

  if (!probe) {
    return NextResponse.json(doc, { headers: cors() });
  }

  const live = await runInteropProbe(origin);
  const allPass = live.profiles.every((p) => p.status === "pass");

  return NextResponse.json(
    {
      ...doc,
      live,
      reference_node: allPass,
    },
    {
      headers: cors(),
      status: allPass ? 200 : 503,
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
