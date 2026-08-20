import { NextResponse } from "next/server";
import { buildRightsManifest } from "@/lib/rightsGraph/publicSurface";

export const runtime = "nodejs";
export const revalidate = 300;

/** Rights Graph discovery — the free-to-read entry point of the flywheel. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildRightsManifest(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
