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
      version: "1.1.0",
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
