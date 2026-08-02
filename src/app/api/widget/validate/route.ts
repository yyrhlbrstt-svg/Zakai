import { NextResponse } from "next/server";
import { validateWidgetKey } from "@/lib/widget/keys";
import { widgetCorsHeaders } from "@/lib/widget/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: widgetCorsHeaders(request),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get("Origin");
  const key = request.headers.get("X-Zakai-Widget-Key");
  const valid = validateWidgetKey(key, origin);

  const cors = widgetCorsHeaders(request, {
    allowOrigin: valid && origin ? origin : "*",
  });

  if (!valid) {
    return NextResponse.json({ valid: false }, { status: 403, headers: cors });
  }
  return NextResponse.json(
    { valid: true, widget_version: "1.0.0" },
    { headers: cors },
  );
}
