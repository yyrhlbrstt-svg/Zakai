import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { buildCatalogResponse } from "@/lib/protocol/zml/catalog";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";

export const runtime = "nodejs";
export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("rights-catalog", ip, 60, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 60 },
      { status: 429, headers: CORS },
    );
  }

  const url = new URL(request.url);
  const market = (url.searchParams.get("market") ?? "IL").toUpperCase();
  const category = url.searchParams.get("category") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const zmlVersion = url.searchParams.get("zml_version") ?? ZML_VERSION;
  if (zmlVersion.split(".")[0] !== ZML_VERSION.split(".")[0]) {
    return NextResponse.json(
      { error: "unsupported_zml_version", supported: ZML_VERSION },
      { status: 400, headers: CORS },
    );
  }

  const origin = url.origin;
  const catalog = buildCatalogResponse(origin, market, { category, cursor });
  if (!catalog) {
    return NextResponse.json({ error: "unknown_market", market }, { status: 404, headers: CORS });
  }

  return NextResponse.json(catalog, { headers: CORS });
}
