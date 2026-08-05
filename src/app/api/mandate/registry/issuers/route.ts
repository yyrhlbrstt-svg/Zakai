import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { registerFullIssuer } from "@/lib/mandate/trustRegistry";
import { secretsMatch } from "@/lib/security/timingSafe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminOk(request: Request): boolean {
  const token = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("Authorization") || "";
  return secretsMatch(auth, `Bearer ${token}`);
}

const schema = z.object({
  iss: z.string().url().max(400),
  name: z.string().trim().min(2).max(120),
  jwksUri: z.string().url().max(400),
  statusListUri: z.string().url().max(400),
  allowedScopes: z.array(z.string()).min(1).max(64),
  status: z.enum(["active", "suspended", "withdrawn"]).default("active"),
  note: z.string().max(500).optional(),
});

/**
 * Admit a full trust-registry issuer — a party running its own Ed25519 keys
 * and JWKS, verified by institutions against this registry directly (not a
 * delegated issuer signed by Zakai; see POST /api/mandate/delegation/issuers
 * for that path). Before this route the only durable admission mechanism was
 * hand-editing ZAKAI_EXTRA_ISSUERS_JSON — one shared blob holding every
 * non-Zakai issuer, with no error surfaced when an entry silently failed
 * validation and no way to suspend one issuer without touching all of them.
 *
 * Admin only. The trust decision (should this party be admitted at all)
 * still happens before this call — same posture as delegation admission:
 * this replaces the error-prone mechanical step, not the judgment call.
 */
export async function POST(request: Request) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const result = await registerFullIssuer(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "admission_refused", problems: result.problems }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    issuer: result.issuer,
    note: "Row is live in RegisteredIssuerRow and already counts toward the trust registry.",
  });
}
