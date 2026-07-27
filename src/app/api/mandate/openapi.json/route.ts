import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal OpenAPI 3 fragment for Mandate institutional endpoints. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const doc = {
    openapi: "3.0.3",
    info: {
      title: "Zakai Mandate API",
      version: "1.0.0",
      description:
        "Institutional verification of consumer authority. Signature verification is offline via JWKS; status is a thin online recency check.",
    },
    servers: [{ url: origin }],
    paths: {
      "/.well-known/zakai-mandate.json": {
        get: {
          summary: "Discovery document",
          responses: { "200": { description: "Discovery JSON" } },
        },
      },
      "/.well-known/zakai-jwks.json": {
        get: {
          summary: "Public signing keys (JWKS)",
          responses: { "200": { description: "JWKS" } },
        },
      },
      "/api/mandate/status/{jti}": {
        get: {
          summary: "Revocation / recency status",
          parameters: [
            {
              name: "jti",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "status active | revoked" },
            "503": { description: "status unknown / store unavailable" },
          },
        },
      },
      "/api/mandate/verify": {
        post: {
          summary: "Reference verify (token + audience)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token", "audience"],
                  properties: {
                    token: { type: "string" },
                    audience: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "valid" },
            "400": { description: "invalid signature or claims" },
            "410": { description: "revoked" },
          },
        },
      },
      "/api/mandate/scopes": {
        get: {
          summary: "Closed scope vocabulary",
          responses: { "200": { description: "scopes + forbidden" } },
        },
      },
    },
  };

  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
