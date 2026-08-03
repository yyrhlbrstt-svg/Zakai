import { NextResponse } from "next/server";
import { buildAutopilotManifest } from "@/lib/autopilot/runner";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildAutopilotManifest(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
