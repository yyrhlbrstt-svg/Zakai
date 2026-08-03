import { NextResponse } from "next/server";
import { buildFairnessCertifiedDocument } from "@/lib/monopoly/fairnessCertified";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildFairnessCertifiedDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControlHeader("catalog"),
    },
  });
}
