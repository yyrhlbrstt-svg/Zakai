import { NextResponse } from "next/server";
import { buildSwitchingDocument } from "@/lib/protocol/switching";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildSwitchingDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
