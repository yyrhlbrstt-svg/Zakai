import { NextResponse } from "next/server";
import { conformanceDocument } from "@/lib/mandate/conformance";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * The admission test, published.
 *
 * A candidate issuer reads this before writing a line, implements against it,
 * runs it, and submits the result. Nobody at Zakai reads their source. That is
 * the property that lets the registry grow without headcount — and a registry
 * that needs headcount to grow is a partnership programme wearing a protocol's
 * clothes.
 */
export async function GET() {
  return NextResponse.json(conformanceDocument(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
