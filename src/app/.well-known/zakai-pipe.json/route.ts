import { NextResponse } from "next/server";
import { buildZakaiPipeDocument } from "@/lib/pipe/zakaiPipe";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildZakaiPipeDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControlHeader("catalog"),
    },
  });
}
