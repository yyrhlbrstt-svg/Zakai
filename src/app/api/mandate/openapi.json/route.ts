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
      version: "1.2.0",
      description:
        "Institutional verification of consumer authority. Signed, scoped, audience-bound, revocable. " +
        "Offline signature verification via JWKS; online status for revocation/recency. " +
        "Hard constraint: Mandates cannot initiate outbound payments, transfers, loans, or account closure. " +
        "Money only flows toward the principal (refunds, settlements).",
      contact: { url: `${origin}/en/institutions` },
    },
    servers: [{ url: origin }],
    tags: [
      { name: "discovery", description: "Machine-readable discovery" },
      { name: "keys", description: "Public signing keys" },
      { name: "verify", description: "Token verification" },
      { name: "status", description: "Revocation and recency" },
      { name: "scopes", description: "Closed scope vocabulary" },
      { name: "decide", description: "Authorization decisions — the endpoint most integrators want" },
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
      },
      "/api/mandate/verify": {
        post: {
          tags: ["verify"],
          summary: "Reference verify (token + audience)",
          description:
            "Verifies compact JWS, typ, audience binding, expiry, and optionally status. " +
            "Institutions may implement offline verification using JWKS alone and call status separately.",
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
      securitySchemes: {},
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
