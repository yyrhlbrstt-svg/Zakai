import { NextResponse } from "next/server";
import { readPackArtifact } from "@/lib/protocol/packs/serveLocal";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": cacheControlHeader("catalog"),
};

/**
 * Origin CDN mirror for ZML packs (S3 layout).
 * Example: /api/cdn/packs/il/index.json → zakai-packs/packs/il/index.json
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path: parts } = await context.params;
  if (!parts?.length) {
    const artifact = readPackArtifact("manifest.json");
    if (!artifact) return NextResponse.json({ error: "packs_unavailable" }, { status: 503, headers: CORS });
    return new NextResponse(artifact.body, {
      headers: { ...CORS, "Content-Type": artifact.contentType },
    });
  }

  const relative = parts.join("/");
  const artifact = readPackArtifact(relative);
  if (!artifact) {
    return NextResponse.json({ error: "not_found", path: relative }, { status: 404, headers: CORS });
  }
  return new NextResponse(artifact.body, {
    headers: { ...CORS, "Content-Type": artifact.contentType },
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
