import { NextResponse } from "next/server";
import { allMarkets } from "@/lib/global/registry";
import { domainDocument } from "@/lib/mandate/domains";

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
    // Deterministic fixtures covering every decision outcome, including the
    // orderings where two rules could both fire — the cases prose is ambiguous
    // about and independent implementations therefore resolve differently and
    // silently. Run them in your own language and you are conformant or you
    // know exactly which rule you got wrong.
    test_vectors_uri: `${origin}/api/mandate/test-vectors`,
    // The second layer. Authorization answers who may act; settlement answers
    // what was agreed, what happened, and who is right when those disagree.
    // Each link is an ordinary JWT signed by the party making the claim and
    // carrying a hash of the link before it, so an outsider — a consumer, a
    // regulator, a court — can check the chain months later without trusting
    // any participant. Adjudication is a pure function of the records: if
    // resolving a dispute needs a human to read anything, it cannot run at the
    // volume agents will produce.
    settlement: {
      version: 1,
      receipt_typ: "JWT",
      receipt_claim_namespace: "zks",
      chain: ["mandate", "decision", "outcome"],
      link_hash: "sha256-of-canonical-json",
      verdicts: [
        "performed_as_authorized",
        "authorized_not_performed",
        "refused_with_reason",
        "unauthorized",
        "exceeded_scope",
        "outside_mandate_window",
        "broken_chain",
        // A real verdict, not a failure. A procedure that always produces a
        // winner is one that will sometimes invent one.
        "indeterminate",
      ],
      // Each party signs only its own statement, and no central party — this
      // one included — can fabricate a link.
      signed_by: { decision: "institution", outcome: "asserting_party" },
      // Check the canonical-hash fixtures before any verdict. Two
      // implementations that serialise a record differently compute different
      // hashes, reject each other's perfectly valid chains, and each concludes
      // the other's cryptography is broken — the most common way this category
      // of format fails between languages.
      test_vectors_uri: `${origin}/api/settlement/test-vectors`,
    },
    // A second way in, for an agent that would rather not run Ed25519 keys or
    // a JWKS of its own. Zakai signs on that agent's behalf, and the signed
    // token says so structurally — not as a sentence an institution has to
    // parse, but as `zkm.onBehalfOf: { agent, name, note }` inside the
    // verified claims, right next to `principal` and `scope`. An institution
    // that only checks `aud`, `scope` and expiry will keep working; one that
    // wants to price or log delegated activity differently reads this field.
    delegated_issuance: {
      description:
        "Third parties without their own signing infrastructure can have Zakai issue mandates on their behalf. Every such mandate discloses the delegation inside the token itself: Zakai vouches for the signature, the named agent for the principal's identity — never the reverse.",
      issue_uri: `${origin}/api/mandate/issue`,
      onbehalfof_claim: "zkm.onBehalfOf",
      onbehalfof_shape: { agent: "string (issuer slug)", name: "string", note: "string" },
      onbehalfof_absent_means: "first_party — verified directly by Zakai",
      admission: "Not self-service. See integration_doc.",
    },
    // What makes this worth building against rather than an API that might
    // change under an integrator without notice. Stated here, not only in a
    // repository doc, because it is the credibility question institutions
    // actually ask before adopting infrastructure.
    stability: {
      current_version: 1,
      policy: [
        "v1 claims are additive-only: a new optional field can appear without a version bump, and a verifier that ignores unrecognised fields keeps working.",
        "No claim name is ever repurposed. A retired field is retired, never redefined to mean something else.",
        "Forbidden scopes only grow. A scope may move from permitted to forbidden; the reverse never happens without a major version.",
        "A major version bump carries a minimum 180-day overlap window before the prior version stops verifying, published here when scheduled.",
      ],
    },
    openapi_uri: `${origin}/api/mandate/openapi.json`,
    human_verify_uri: `${origin}/verify`,
    integration_doc: `${origin}/en/institutions`,
    security_contact: `${origin}/.well-known/security.txt`,
    markets: allMarkets().map((m) => m.code),
    // What an agent may never do, per sector — published before any of these
    // sectors exists as a customer. A categorical limit that appears at the
    // same time as the sales conversation reads as something invented for it.
    // Only finance is issuable today and the document says so; the rest are
    // reserved with their limits already fixed, because a limit decided after
    // the first customer asks for an exception is a negotiating position.
    domains: domainDocument(),
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
