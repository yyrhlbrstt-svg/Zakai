import { NextResponse } from "next/server";
import { registerWidgetKey } from "@/lib/widget/keys";

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
  const api_key = await registerWidgetKey(body.domain.trim());
  return NextResponse.json({ api_key, domain: body.domain });
}

