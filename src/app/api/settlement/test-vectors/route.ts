import { NextResponse } from "next/server";
import { settlementVectorDocument } from "@/lib/settlement/vectors";

export const runtime = "nodejs";

/**
 * Settlement test vectors, published.
 *
 * The authorization vectors made that layer implementable by strangers, and
 * writing them found three real defects. These do the same for the layer that
 * decides who is right — and they carry one thing the authorization vectors do
 * not need: canonical-hash fixtures.
 *
 * Every link in a settlement chain points at the previous one by hash, so two
 * implementations that serialise the same record differently compute different
 * hashes, reject each other's perfectly valid chains, and each concludes the
 * other's cryptography is broken. That is the most common way this category of
 * format fails between languages, and it is checkable before any verdict is.
 */
export async function GET() {
  return NextResponse.json(settlementVectorDocument(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
