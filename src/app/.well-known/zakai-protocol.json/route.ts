import { NextResponse } from "next/server";
import { buildZakaiProtocolDocument } from "@/lib/protocol/discovery";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Single discovery document for the Zakai protocol stack.
 * Institutions, wallets, and auditors start here — like reading bitcoin.org before integrating.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildZakaiProtocolDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
