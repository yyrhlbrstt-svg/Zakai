import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const body = {
    spec: "zakai-mandate",
    version: 1,
    issuer:
      process.env.MANDATE_ISSUER ||
      process.env.NEXT_PUBLIC_APP_URL ||
      origin,
    description:
      "Signed, scoped, audience-bound, revocable consumer authority. Money may only flow toward the principal.",
    alg: "EdDSA",
    crv: "Ed25519",
    typ: "zakai-mandate+jws",
    jwks_uri: `${origin}/.well-known/zakai-jwks.json`,
    status_uri_template: `${origin}/api/mandate/status/{jti}`,
    verify_uri: `${origin}/api/mandate/verify`,
    scopes_uri: `${origin}/api/mandate/scopes`,
    openapi_uri: `${origin}/api/mandate/openapi.json`,
    human_verify_uri: `${origin}/verify`,
    integration_doc: `${origin}/en/institutions`,
    security_contact: `${origin}/.well-known/security.txt`,
    markets: ["IL", "GB", "US", "DE"],
    constraints: {
      outbound_payments: false,
      forbidden_scopes: [
        "payment:initiate",
        "payment:transfer",
        "credit:borrow",
        "account:open",
        "account:close",
        "investment:trade",
      ],
      audience_bound: true,
      offline_signature_verification: true,
      online_status_check_recommended: true,
    },
    verification_flow: [
      "1. Fetch and cache JWKS from jwks_uri",
      "2. Verify compact JWS (EdDSA) and typ=zakai-mandate+jws",
      "3. Reject if aud does not match your institution id",
      "4. Reject if exp is in the past (with small clock skew)",
      "5. GET status_uri_template with jti; accept only status=active",
      "6. Enforce only the scopes listed in the claims",
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
