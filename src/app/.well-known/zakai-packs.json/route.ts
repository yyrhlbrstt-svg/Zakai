import { NextResponse } from "next/server";
import { buildPacksManifest } from "@/lib/protocol/packs/manifest";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildPacksManifest(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
