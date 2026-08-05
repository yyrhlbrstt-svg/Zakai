import { NextResponse } from "next/server";
import { buildInteropDocument } from "@/lib/protocol/interop";

export const runtime = "nodejs";
export const revalidate = 300;

/** Canonical entrypoint for the Zakai Interoperability Standard (static manifest). */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const doc = buildInteropDocument(origin);
  return NextResponse.json(doc, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      Link: '</api/interop?probe=1>; rel="zakai-interop-probe"',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
