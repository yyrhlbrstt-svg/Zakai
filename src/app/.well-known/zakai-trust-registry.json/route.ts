import { NextResponse } from "next/server";
import { registryDocument } from "@/lib/mandate/trustRegistry";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * The trust registry, as an institution fetches it.
 *
 * Wide-open CORS and a cache header, because this is meant to be read by
 * everyone, constantly, from anywhere — including from a browser. There is
 * nothing here to protect: it is a list of who may issue mandates, where their
 * public keys live, and which scopes no issuer may ever hold. Every one of
 * those is more useful the more widely it is copied.
 */
export async function GET() {
  return NextResponse.json(registryDocument(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Content-Type": "application/json",
    },
  });
}
