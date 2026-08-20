import { NextResponse } from "next/server";
import { buildRightsListing } from "@/lib/rightsGraph/publicSurface";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Every verified right, in full, with its statutory source — free to read by
 * any agent. Draft entries never appear here (enforced in publicSurface.ts,
 * asserted in tests): what this endpoint serves, a letter may cite.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildRightsListing(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
