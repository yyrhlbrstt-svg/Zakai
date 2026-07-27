import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  issueMandate,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.MANDATE_ISSUE_KEY;
  const provided = req.headers.get("x-zakai-issue-key") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit("mandate-issue", clientIp(req), 30, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
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
  const scopes = Array.isArray(body.scopes) ? body.scopes.map(String).slice(0, 32) : [];
  const market = (body.market || "IL").trim().toUpperCase().slice(0, 2);

  if (!audience || !subject || !name || !statement || scopes.length === 0) {
    return NextResponse.json(
      { error: "missing_fields", need: ["audience", "subject", "name", "statement", "scopes"] },
      { status: 400 },
    );
  }
  if (audience.length > 128 || subject.length > 128 || name.length > 200 || statement.length > 4000) {
    return NextResponse.json({ error: "field_too_long" }, { status: 400 });
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
          reference: body.reference?.slice(0, 64),
          contactMasked: body.contactMasked?.slice(0, 64),
        },
        scopes,
        market,
        statement,
        ttlSeconds: body.ttlSeconds,
      },
      key,
    );

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
