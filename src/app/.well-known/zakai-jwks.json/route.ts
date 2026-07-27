import { NextResponse } from "next/server";
import {
  loadSigningKeyFromEnv,
  publicJwkFor,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const key = loadSigningKeyFromEnv();
    const jwk = await publicJwkFor(key);
    return NextResponse.json(
      { keys: [jwk] },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json(
        { error: "mandate_keys_not_configured", keys: [] },
        { status: 503 },
      );
    }
    throw err;
  }
}