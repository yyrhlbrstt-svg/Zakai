import { NextResponse } from "next/server";
import { registerEvidenceKey } from "@/lib/evidence/keys";
import { secretsMatch } from "@/lib/security/timingSafe";

export const runtime = "nodejs";

function adminOk(request: Request): boolean {
  const token = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("Authorization") || "";
  return secretsMatch(auth, `Bearer ${token}`);
}

/** Mint a per-customer key for the licensed evidence API. Founder/ops only. */
export async function POST(request: Request) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { label?: string };
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "label_required" }, { status: 400 });
  }
  const api_key = await registerEvidenceKey(body.label.trim());
  return NextResponse.json({
    api_key,
    label: body.label.trim(),
    durable: true,
    note: "Key is stored in EvidenceKey (Postgres). Send it as: Authorization: Bearer <api_key>.",
  });
}
