import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { buildCatalogResponse } from "@/lib/protocol/zml/catalog";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";
import { validateWidgetKey } from "@/lib/widget/keys";
import { widgetCorsHeaders } from "@/lib/widget/cors";

export const runtime = "nodejs";
export const revalidate = 300;

function catalogCors(request: Request, allowOrigin?: string | null) {
  return widgetCorsHeaders(request, { allowOrigin: allowOrigin ?? "*" });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: catalogCors(request) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const widgetKey = request.headers.get("X-Zakai-Widget-Key");
  const requestOrigin = request.headers.get("Origin");
  if (widgetKey) {
    const ok = validateWidgetKey(widgetKey, requestOrigin);
    if (!ok) {
      return NextResponse.json(
        { error: "invalid_widget_key" },
        { status: 403, headers: catalogCors(request, requestOrigin) },
      );
    }
  }

  const ip = clientIp(request);
  const limited = await rateLimit("rights-catalog", ip, 60, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 60 },
      {
        status: 429,
        headers: {
          ...catalogCors(request),
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  }

  const market = (url.searchParams.get("market") ?? "IL").toUpperCase();
  const category = url.searchParams.get("category") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const zmlVersion = url.searchParams.get("zml_version") ?? ZML_VERSION;
  if (zmlVersion.split(".")[0] !== ZML_VERSION.split(".")[0]) {
    return NextResponse.json(
      { error: "unsupported_zml_version", supported: ZML_VERSION },
      { status: 400, headers: catalogCors(request) },
    );
  }

  const catalog = await buildCatalogResponse(url.origin, market, { category, cursor });
  if (!catalog) {
    return NextResponse.json(
      { error: "unknown_market", market },
      { status: 404, headers: catalogCors(request) },
    );
  }

  const cache = "public, max-age=300, stale-while-revalidate=3600";
  return NextResponse.json(catalog, {
    headers: { ...catalogCors(request), "Cache-Control": cache },
  });
}
