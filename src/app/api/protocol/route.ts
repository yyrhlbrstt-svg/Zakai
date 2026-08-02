import { NextResponse } from "next/server";
import { buildZakaiProtocolDocument } from "@/lib/protocol/discovery";

export const runtime = "nodejs";
export const revalidate = 300;

/** JSON discovery alias for integrators (same payload as /.well-known/zakai-protocol.json). */
export async function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
  const doc = buildZakaiProtocolDocument(origin);
  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
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
