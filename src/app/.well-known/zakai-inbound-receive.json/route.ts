import { NextResponse } from "next/server";
import { buildInboundReceiveDocument } from "@/lib/protocol/inboundReceive";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildInboundReceiveDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControlHeader("catalog"),
    },
  });
}
