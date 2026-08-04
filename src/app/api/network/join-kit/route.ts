import { NextResponse } from "next/server";
import { buildJoinKitDocument } from "@/lib/monopoly/joinKit";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 120;

/** Public adoptability kit — institutions / issuers / agents / pack developers. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildJoinKitDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControlHeader("catalog"),
    },
  });
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
