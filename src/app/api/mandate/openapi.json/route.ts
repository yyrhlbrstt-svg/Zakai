import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenAPI 3 fragment for Mandate institutional endpoints. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const doc = {
    openapi: "3.0.3",
    info: {
      title: "Zakai Mandate API",
      version: "1.3.0",
      description:
        "Institutional verification of consumer authority. Signed, scoped, audience-bound, revocable. " +
        "Offline signature verification via JWKS; revocation via signed status list at zkm.status " +
        "(live /status/{jti} only for legacy tokens without that claim). " +
        "Hard constraint: Mandates cannot initiate outbound payments, transfers, loans, or account closure. " +
        "Money only flows toward the principal (refunds, settlements).",
      contact: { url: `${origin}/en/institutions` },
    },
    servers: [{ url: origin }],
    tags: [
      { name: "discovery", description: "Machine-readable discovery" },
      { name: "keys", description: "Public signing keys" },
      { name: "issue", description: "Mint a mandate, first-party or delegated" },
      { name: "verify", description: "Token verification" },
      { name: "status", description: "Revocation and recency" },
      { name: "scopes", description: "Closed scope vocabulary" },
      { name: "decide", description: "Authorization decisions — the endpoint most integrators want" },
      { name: "delegation", description: "Become a delegated issuer" },
      { name: "conformance", description: "Test vectors for implementing this yourself" },
    ],
    paths: {
      "/.well-known/zakai-mandate.json": {
        get: {
          tags: ["discovery"],
          summary: "Discovery document",
          description: "Issuer, JWKS URI, status template, constraints, verification flow.",
          responses: {
            "200": {
              description: "Discovery JSON",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      spec: { type: "string", example: "zakai-mandate" },
                      version: { type: "integer", example: 1 },
                      alg: { type: "string", example: "EdDSA" },
                      crv: { type: "string", example: "Ed25519" },
                      jwks_uri: { type: "string" },
                      status_uri_template: { type: "string" },
                      verify_uri: { type: "string" },
                      scopes_uri: { type: "string" },
                      constraints: {
                        type: "object",
                        properties: {
                          outbound_payments: { type: "boolean", example: false },
                          audience_bound: { type: "boolean", example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/.well-known/zakai-jwks.json": {
        get: {
          tags: ["keys"],
          summary: "Public signing keys (JWKS)",
          description: "Cache and rotate per standard JWKS practice. Alg EdDSA / crv Ed25519.",
          responses: { "200": { description: "JWKS" } },
        },
      },
      "/.well-known/zakai-trust-registry.json": {
        get: {
          tags: ["discovery"],
          summary: "The registry of every admitted issuer",
          description:
            "Who may issue mandates, where their public keys and status list live, which scopes they " +
            "are admitted for, and the forbidden set that binds every issuer with no override path. " +
            "Wide-open CORS on purpose: nothing here is sensitive, and it is more useful the more widely " +
            "it is copied.",
          responses: { "200": { description: "Trust registry JSON" } },
        },
      },
      "/.well-known/zakai-conformance.json": {
        get: {
          tags: ["conformance"],
          summary: "The admission test for becoming a registered issuer",
          description:
            "For a party that signs its own mandates with its own Ed25519 keys and wants an iss of its " +
            "own in the trust registry — distinct from delegated issuance, where Zakai signs on your " +
            "behalf and you hold no key at all. Pure and dependency-free: run it against your own " +
            "endpoints, get a signed-off result, and the registry admits on the evidence. Nobody at " +
            "Zakai reads your source.",
          responses: { "200": { description: "Conformance suite: checks and admission rules" } },
        },
      },
      "/api/mandate/conformance/probe": {
        post: {
          tags: ["conformance"],
          summary: "Independently verify a candidate issuer's conformance, without reading their code",
          description:
            "The self-attested route above asks a candidate to run the suite against their own endpoints " +
            "and report back; this route runs the reference verifier here, against artifacts the candidate " +
            "submits, as a neutral judge instead of trusting their report. Settles publishes_jwks, " +
            "issues_valid_jwt, registered_claims_present, scope_is_oauth_shaped, refuses_forbidden_scope, " +
            "rejects_forged_signature, enforces_audience, and publishes_status_list (sample must embed " +
            "zkm.status). enforces_expiry is included only if sampleExpiredToken is supplied — never " +
            "faked as passing. revocation_takes_effect still needs a post-revoke refresh window and is " +
            "absent here (report.missing). The JWKS is submitted inline rather than fetched from a " +
            "candidate-supplied URL, since a server-side fetch of an arbitrary caller-given URL would " +
            "make this endpoint usable to probe internal addresses.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["jwks", "audience", "sampleValidToken"],
                  properties: {
                    jwks: { type: "array", items: { type: "object" }, description: "The candidate's own public JWKS keys, 1-8" },
                    audience: { type: "string", description: "The audience the sampleValidToken was actually issued for" },
                    sampleValidToken: { type: "string", description: "A currently-valid mandate the candidate issued" },
                    sampleExpiredToken: { type: "string", description: "Optional: an already-expired sample, to check enforces_expiry" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Independent probe results and the resulting conformance report",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      results: { type: "array", items: { type: "object" } },
                      report: { type: "object", description: "Same shape as assessConformance() produces internally" },
                    },
                  },
                },
              },
            },
            "400": { description: "invalid_input" },
            "429": { description: "rate limited" },
          },
        },
      },
      "/api/mandate/issue": {
        post: {
          tags: ["issue"],
          summary: "Mint a mandate",
          description:
            "Two callers share this endpoint and are never conflated in the result. The first-party " +
            "key issues for this product's own users, whose identity it verified directly. A delegated " +
            "issuer's key issues for users Zakai has never met, so those tokens carry " +
            "zkm.onBehalfOf naming the agent — structurally, not as a sentence a verifier has to parse. " +
            "A delegated caller may only request scopes inside its own allowed_scopes; asking for more " +
            "is refused here; requesting a scope in forbidden_scopes fails validation the same as it " +
            "would for a first-party mandate.",
          security: [{ zakaiIssueKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["audience", "subject", "name", "statement", "scopes"],
                  properties: {
                    audience: { type: "string", description: "The institution id this mandate is scoped to" },
                    subject: { type: "string", description: "The person the mandate concerns" },
                    name: { type: "string", description: "The principal's name, as stated" },
                    statement: { type: "string", description: "Plain-language statement of authority granted" },
                    scopes: { type: "array", items: { type: "string" }, description: "From the closed vocabulary at scopes_uri" },
                    market: { type: "string", description: "ISO-3166 alpha-2, defaults to IL" },
                    reference: { type: "string", description: "Your own reference for this principal, echoed back nowhere but useful in your logs" },
                    contactMasked: { type: "string" },
                    ttlSeconds: { type: "integer", description: "Requested lifetime; issuer may cap it" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Mandate issued",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      jti: { type: "string" },
                      token: { type: "string", description: "Compact JWS — the mandate itself" },
                      exp: { type: "integer" },
                      onBehalfOf: { type: "string", description: "Present only for a delegated issuer, echoing its own slug" },
                      jwks: { type: "string" },
                      statusPath: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "missing_fields | field_too_long | invalid_json | a requested scope is unknown or forbidden" },
            "401": { description: "unauthorized — missing or unrecognised x-zakai-issue-key" },
            "403": { description: "delegation_refused — requested scope outside this issuer's allowed_scopes" },
            "429": { description: "rate limited" },
            "503": { description: "mandate_keys_not_configured" },
          },
        },
      },
      "/api/mandate/status/{jti}": {
        get: {
          tags: ["status"],
          summary: "Revocation / recency status",
          parameters: [
            {
              name: "jti",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "JWT ID from the Mandate claims",
            },
          ],
          responses: {
            "200": {
              description: "status active | revoked",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      jti: { type: "string" },
                      status: { type: "string", enum: ["active", "revoked"] },
                    },
                  },
                },
              },
            },
            "503": { description: "status unknown / store unavailable" },
          },
        },
        post: {
          tags: ["status"],
          summary: "Ops revoke — flips the issue-time bit on the signed status list",
          description:
            "Requires x-zakai-revoke-key. Reuses the statusIndex allocated at issue " +
            "(MandateStatusAllocation / Authorization.mandateStatusIndex) so offline " +
            "verifiers holding /api/mandate/revocations see zkm.status.idx flip. " +
            "Never invents a new bit — missing issue-time index → 409 status_index_unknown.",
          parameters: [
            {
              name: "jti",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "revoked — includes statusIndex" },
            "401": { description: "unauthorized" },
            "409": { description: "status_index_unknown — no issue-time bit; refuse to invent" },
            "503": { description: "status_store_unavailable or status_list_capacity" },
          },
        },
      },
      "/api/mandate/verify": {
        post: {
          tags: ["verify"],
          summary: "Reference verify (token + audience)",
          description:
            "Verifies compact JWS, typ, audience binding, expiry, and revocation. " +
            "When the token embeds zkm.status, the signed status list is authoritative " +
            "(list unreachable → revocation_unknown, never valid:true). Legacy tokens " +
            "without zkm.status use live /status/{jti}.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token", "audience"],
                  properties: {
                    token: { type: "string", description: "Compact JWS Mandate" },
                    audience: {
                      type: "string",
                      description: "Your institution id — must match aud claim",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "valid — claims returned" },
            "400": { description: "invalid signature or claims" },
            "410": { description: "revoked" },
            "503": {
              description:
                "revocation_unknown or mandate_keys_not_configured — never valid:true when the revocation store is unreachable",
            },
          },
        },
      },
      "/api/mandate/decide": {
        post: {
          tags: ["decide"],
          summary: "May this agent do this, right now?",
          description:
            "Returns a decision rather than evidence. /verify answers whether a token is authentic and " +
            "leaves you to match scopes, enforce per-act confirmation and decide what an unknown " +
            "revocation status means — roughly fifty lines every integrator writes, writes differently, " +
            "and gets one of wrong. This answers the whole question.\n\n" +
            "A denial returns 200 with decision:\"deny\", never 4xx. A refusal is a successful answer to " +
            "a legitimate question, and conflating it with a network error is how integrations fail open.\n\n" +
            "Deny by default: no path returns permit on error, and a revocation status that could not be " +
            "established is a denial rather than a permit with a warning.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token", "audience", "action"],
                  properties: {
                    token: { type: "string", description: "The mandate JWT" },
                    audience: {
                      type: "string",
                      description: "Your institution id — must match the aud claim",
                    },
                    action: {
                      type: "string",
                      description: "The act being attempted, as a scope string",
                      example: "dispute:charge",
                    },
                    subject: {
                      type: "string",
                      description: "The person the act concerns, if you enforce it",
                    },
                    market: { type: "string", description: "ISO-3166 alpha-2, if you enforce it" },
                    actConfirmation: {
                      type: "string",
                      description:
                        "Your reference for the principal's confirmation of THIS act. Required for " +
                        "per-act scopes: holding \"may cancel my subscriptions\" is not agreement to " +
                        "cancel this one.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "A decision. Both permit and deny are 200.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      decision: { type: "string", enum: ["permit", "deny"] },
                      reason: {
                        type: "string",
                        description:
                          "Present on every denial, absent on permit. A closed set — safe to branch " +
                          "on, and it will not change without a version change.",
                        enum: [
                          "expired",
                          "not_yet_valid",
                          "audience_mismatch",
                          "subject_mismatch",
                          "market_mismatch",
                          "scope_not_granted",
                          "scope_unknown",
                          "scope_forbidden",
                          "act_confirmation_required",
                          "revoked",
                          "revocation_unknown",
                          "malformed_claims",
                          "invalid_token",
                        ],
                      },
                      obligations: {
                        type: "array",
                        items: { type: "string" },
                        description: "What you must record or notify. Empty on a denial.",
                        example: ["record:mnd_123", "notify_principal:dispute:charge"],
                      },
                      permitted: {
                        type: "array",
                        items: { type: "string" },
                        description: "Everything else this token would authorise here right now.",
                      },
                      expiresInSeconds: { type: "integer" },
                      jti: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "missing or malformed request fields" },
            "429": { description: "rate limited" },
            "503": { description: "issuer key unavailable" },
          },
        },
      },
      "/api/mandate/test-vectors": {
        get: {
          tags: ["conformance"],
          summary: "Deterministic vectors for your own implementation",
          description:
            "Fixed key, fixed timestamps, fixed identifiers, covering every denial reason plus the " +
            "orderings where two rules could both fire — the cases prose is ambiguous about and " +
            "independent implementations therefore resolve differently and silently.\n\n" +
            "Run them against your own code and you are conformant, or you know exactly which rule you " +
            "got wrong. There is no partial credit: one wrong answer in a trust network is one " +
            "participant honouring something nobody else does.\n\n" +
            "Five zero-dependency reference implementations (Python, Go, Java, Ruby, PHP) all pass " +
            "these — a specification only its author has implemented is an API with documentation.",
          responses: { "200": { description: "Vector document" } },
        },
      },
      "/api/mandate/ready": {
        get: {
          tags: ["conformance"],
          summary: "Machine readiness — READY_FOR_PIONEER gate",
          description:
            "Runs published authorization vectors and cryptographically verifies the signed Status List. " +
            "Returns ready_for_pioneer when both pass. Same gate as Pioneer wall listing — not regulatory " +
            "certification and not proof of production volume. Client twin: npx zakai-mandate-ready.",
          responses: {
            "200": {
              description:
                "{ ok, ready, ready_for_pioneer, vectors, status_list, next, disclaimer }",
            },
          },
        },
      },
      "/api/settlement/test-vectors": {
        get: {
          tags: ["conformance"],
          summary: "Settlement vectors, including canonical-hash fixtures",
          description:
            "Check the hash fixtures before any verdict. Every link in a settlement chain points at " +
            "the previous one by hash, so two implementations that serialise a record differently " +
            "compute different hashes, reject each other's perfectly valid chains, and each concludes " +
            "the other's cryptography is broken. A right verdict from a wrong hash is agreement about " +
            "nothing.",
          responses: { "200": { description: "Settlement vector document" } },
        },
      },
      "/api/mandate/revocations": {
        get: {
          tags: ["status"],
          summary: "Signed status list (IETF Token Status List)",
          description:
            "A signed, compressed bitstring of every revocation. Fetch it every few minutes, verify " +
            "once, then answer revocation offline in a single bit lookup — at any volume, with no live " +
            "dependency on us being reachable. A million mandates compress under 20KB.",
          responses: {
            "200": { description: "statuslist+jwt" },
            "503": { description: "issuer key unavailable" },
          },
        },
      },
      "/api/mandate/scopes": {
        get: {
          tags: ["scopes"],
          summary: "Closed scope vocabulary",
          description: "Allowed scopes plus explicit forbidden set (payment:initiate, transfer, etc.).",
          responses: {
            "200": {
              description: "scopes + forbidden",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      scopes: { type: "array", items: { type: "string" } },
                      forbidden: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/mandate/delegation/apply": {
        post: {
          tags: ["delegation"],
          summary: "Apply to become a delegated issuer",
          description:
            "Self-service intake for a third-party agent that wants Zakai to sign mandates on its " +
            "behalf rather than run its own Ed25519 infrastructure. Requested scopes are validated " +
            "immediately against the same forbidden/known-scope rules decide() enforces, so an " +
            "invalid request fails at submission rather than after a human eventually reads it. " +
            "Approval — turning this into a real key — is a manual, human-reviewed step.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug", "name", "contactEmail", "useCase", "requestedScopes"],
                  properties: {
                    slug: { type: "string", example: "yourbot.example" },
                    name: { type: "string" },
                    contactEmail: { type: "string", format: "email" },
                    useCase: { type: "string", minLength: 20 },
                    requestedScopes: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "application received" },
            "400": { description: "invalid input, or a requested scope is unknown/forbidden" },
            "429": { description: "rate limited" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        zakaiIssueKey: {
          type: "apiKey",
          in: "header",
          name: "x-zakai-issue-key",
          description:
            "Either the first-party issuance secret, or a delegated issuer's own key from " +
            "/api/mandate/delegation/apply once approved. Compared in constant time; an unrecognised " +
            "or missing key is a 401, not a fallback to reduced privilege.",
        },
      },
    },
  };

  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
