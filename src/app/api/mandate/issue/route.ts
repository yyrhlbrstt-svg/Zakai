import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  issueMandate,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issue a signed Mandate (compact JWS) for presentation to an institution.
 *
 * Body JSON:
 *   audience   string   institution id the mandate is bound to (required)
 *   subject    string   principal's stable Zakai id (required)
 *   name       string   principal display name (required)
 *   scopes     string[] closed-set scopes from scopes.ts (required)
 *   market     string   ISO 3166-1 alpha-2 (default IL)
 *   statement  string   human-readable authority text (required)
 *   reference  string?  national/customer id the institution needs
 *   contactMasked string?
 *   ttlSeconds number?
 *
 * Auth: shared secret header until session wiring is complete on this path.
 *   X-Zakai-Issue-Key: process.env.MANDATE_ISSUE_KEY
 *
 * Returns: { jti, token, exp }
 */
export async function POST(req: Request) {
  const expected = process.env.MANDATE_ISSUE_KEY;
  const provided = req.headers.get("x-zakai-issue-key") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    audience?: string;
    subject?: string;
    name?: string;
    scopes?: string[];
    market?: string;
    statement?: string;
    reference?: string;
    contactMasked?: string;
    ttlSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const audience = (body.audience || "").trim();
  const subject = (body.subject || "").trim();
  const name = (body.name || "").trim();
  const statement = (body.statement || "").trim();
  const scopes = Array.isArray(body.scopes) ? body.scopes : [];
  const market = (body.market || "IL").trim().toUpperCase();

  if (!audience || !subject || !name || !statement || scopes.length === 0) {
    return NextResponse.json(
      { error: "missing_fields", need: ["audience", "subject", "name", "statement", "scopes"] },
      { status: 400 },
    );
  }

  const jti = randomUUID();
  const issuer =
    process.env.MANDATE_ISSUER ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://zakai-3uxj.vercel.app";

  try {
    const key = loadSigningKeyFromEnv();
    const token = await issueMandate(
      {
        jti,
        issuer,
        audience,
        subject,
        principal: {
          name,
          reference: body.reference,
          contactMasked: body.contactMasked,
        },
        scopes,
        market,
        statement,
        ttlSeconds: body.ttlSeconds,
      },
      key,
    );

    // Decode exp from payload without re-verifying (we just signed it).
    const payloadB64 = token.split(".")[1];
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const claims = JSON.parse(payloadJson) as { exp: number };

    return NextResponse.json({
      jti,
      token,
      exp: claims.exp,
      jwks: "/.well-known/zakai-jwks.json",
      statusPath: `/api/mandate/status/${jti}`,
    });
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json({ error: "mandate_keys_not_configured" }, { status: 503 });
    }
    if (err instanceof MandateError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    throw err;
  }
}
