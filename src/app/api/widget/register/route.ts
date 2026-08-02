import { NextResponse } from "next/server";
import { registerWidgetKey, validateWidgetKey } from "@/lib/widget/keys";

export const runtime = "nodejs";

function adminOk(request: Request): boolean {
  const token = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!token) return false;
  return request.headers.get("Authorization") === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { domain?: string };
  if (!body.domain?.trim()) {
    return NextResponse.json({ error: "domain_required" }, { status: 400 });
  }
  const api_key = registerWidgetKey(body.domain.trim());
  return NextResponse.json({
    api_key,
    domain: body.domain,
    note: "Persist key in ZAKAI_WIDGET_KEYS_JSON on the deployment for production.",
  });
}

export async function GET(request: Request) {
  const key = request.headers.get("X-Zakai-Widget-Key");
  const origin = request.headers.get("Origin");
  const valid = validateWidgetKey(key, origin);
  if (!valid) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }
  return NextResponse.json({ valid: true });
}
