import { NextResponse } from "next/server";
import { vectorDocument } from "@/lib/mandate/vectors";

export const runtime = "nodejs";

/**
 * The test vectors, published.
 *
 * A specification tells an implementer what to do. Vectors let them find out
 * whether they did it — in their own language, on their own machine, at three
 * in the morning, without asking anybody here. That difference is what decides
 * whether a registry ever gets a second issuer, and it is why every protocol
 * that spread shipped vectors and every one that shipped only prose produced a
 * decade of interop bugs.
 *
 * Static and cacheable: these bytes must be identical forever, because an
 * implementation certified against one version of a vector and then silently
 * handed another has been told its correct code is broken.
 */
export async function GET() {
  return NextResponse.json(vectorDocument(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
