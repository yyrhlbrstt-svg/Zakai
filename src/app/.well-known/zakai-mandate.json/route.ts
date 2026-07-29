import { NextResponse } from "next/server";
import { allMarkets } from "@/lib/global/registry";

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
    // A mandate is a plain JWT. Anything with a JWT library verifies it in
    // three lines, and gets audience, issuer and expiry validation for free —
    // which are exactly the checks that get hand-written wrong.
    typ: "JWT",
    // Still accepted on verification so nothing already issued breaks.
    legacy_typ: "zakai-mandate+jws",
    // The grant is carried as an OAuth 2.0 space-delimited `scope` claim, so a
    // gateway that already speaks OAuth reads it without learning anything
    // about Zakai. Everything JWT does not define sits under `zkm`.
    scope_claim: "scope",
    private_claim_namespace: "zkm",
    jwks_uri: `${origin}/.well-known/zakai-jwks.json`,
    // Multi-issuer: Zakai is one issuer in this registry, on the same terms as
    // anyone else. A registry whose operator holds private privileges is one
    // nobody else joins.
    trust_registry_uri: `${origin}/.well-known/zakai-trust-registry.json`,
    // A signed, compressed bitstring of every revocation, per the IETF Token
    // Status List draft. Fetch it every few minutes, verify once, then answer
    // revocation offline in one bit lookup — at any volume, and without a live
    // dependency on us being reachable.
    status_list_uri: `${origin}/api/mandate/revocations`,
    status_list_type: "statuslist+jwt",
    status_uri_template: `${origin}/api/mandate/status/{jti}`,
    verify_uri: `${origin}/api/mandate/verify`,
    // The endpoint most institutions actually want. `verify` answers whether a
    // token is authentic and leaves the caller to match scopes, enforce
    // per-act confirmation and decide what an unknown revocation status means
    // — fifty lines every integrator writes and one of them gets wrong.
    // `decide` answers the whole question and returns permit or deny with a
    // reason from a closed set.
    decide_uri: `${origin}/api/mandate/decide`,
    scopes_uri: `${origin}/api/mandate/scopes`,
    openapi_uri: `${origin}/api/mandate/openapi.json`,
    human_verify_uri: `${origin}/verify`,
    integration_doc: `${origin}/en/institutions`,
    security_contact: `${origin}/.well-known/security.txt`,
    markets: allMarkets().map((m) => m.code),
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
      "1. Fetch and cache the JWKS from jwks_uri (and the issuer's, from trust_registry_uri)",
      "2. Verify the JWT with your existing library: alg EdDSA, and pass your own institution id as the expected audience and this issuer as the expected issuer. Expiry and not-before are checked for you.",
      "3. Confirm the issuer is listed as active in the trust registry, and that every scope in the token is inside that issuer's allowed_scopes",
      "4. Fetch status_list_uri, verify its signature, and check the bit at zkm.status.idx. This replaces a per-mandate call to us.",
      "5. Act only within the scopes granted. No mandate from any issuer may ever carry a scope in forbidden_scopes.",
    ],
    // Copy-pasteable, because a protocol nobody can implement in ten minutes is
    // a specification, not a standard.
    examples: {
      node: "import { jwtVerify, createRemoteJWKSet } from 'jose';\nconst jwks = createRemoteJWKSet(new URL(JWKS_URI));\nconst { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, audience: MY_INSTITUTION_ID });\nconst scopes = String(payload.scope).split(' ');",
      python: "import jwt\nfrom jwt import PyJWKClient\nkey = PyJWKClient(JWKS_URI).get_signing_key_from_jwt(token).key\nclaims = jwt.decode(token, key, algorithms=['EdDSA'], issuer=ISSUER, audience=MY_INSTITUTION_ID)\nscopes = claims['scope'].split(' ')",
      go: "// github.com/lestrrat-go/jwx/v2/jwt\nset, _ := jwk.Fetch(ctx, jwksURI)\ntok, err := jwt.Parse(token, jwt.WithKeySet(set), jwt.WithIssuer(issuer), jwt.WithAudience(myInstitutionID))",
      curl: "curl -s $JWKS_URI   # then verify with any JWT library; no Zakai SDK required",
      // The five-line path, for an institution that would rather not hold any
      // authorization logic at all. Note the deny is a 200: a refusal is a
      // successful answer, and conflating it with a network error is how
      // integrations end up failing open.
      decide:
        "curl -s $DECIDE_URI -H 'Content-Type: application/json' -d '{\"token\":\"<jwt>\",\"audience\":\"my-institution-id\",\"action\":\"dispute:charge\",\"actConfirmation\":\"<your-ref>\"}'\n# -> {\"decision\":\"permit\"|\"deny\",\"reason\":\"...\",\"obligations\":[...],\"permitted\":[...]}",
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
