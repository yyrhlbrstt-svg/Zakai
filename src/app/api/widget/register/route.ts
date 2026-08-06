import { NextResponse } from "next/server";
import { registerWidgetKey } from "@/lib/widget/keys";
import { secretsMatch } from "@/lib/security/timingSafe";

export const runtime = "nodejs";

function adminOk(request: Request): boolean {
  const token = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("Authorization") || "";
  return secretsMatch(auth, `Bearer ${token}`);
}

export async function POST(request: Request) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { domain?: string };
  if (!body.domain?.trim()) {
    return NextResponse.json({ error: "domain_required" }, { status: 400 });
  }
  const api_key = await registerWidgetKey(body.domain.trim());
  return NextResponse.json({
    api_key,
    domain: body.domain.trim(),
    durable: true,
    note: "Key is stored in WidgetKey (Postgres). Optional bootstrap override: ZAKAI_WIDGET_KEYS_JSON.",
  });
}
