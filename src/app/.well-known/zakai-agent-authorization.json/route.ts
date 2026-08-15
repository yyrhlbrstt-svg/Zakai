import { NextResponse } from "next/server";
import { cacheControlHeader } from "@/lib/scale/publicCache";
import { SCOPES, FORBIDDEN_SCOPES } from "@/lib/mandate/scopes";
import {
  MAX_SCOPES_PER_REQUEST,
  MAX_GRANT_SECONDS,
  DEFAULT_GRANT_SECONDS,
  REQUEST_TTL_MS,
} from "@/lib/agentAuth/request";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * How an outside agent asks a person for authority.
 *
 * Nineteen protocol documents were already served from `.well-known/` and not
 * one described this, because until now there was no way to do it. A protocol
 * nobody can discover is a protocol nobody uses.
 *
 * Generated from the same constants the code enforces — the scope list, the
 * forbidden list, the limits — so this cannot drift into describing a system
 * we do not have. Every published field is read from source, never retyped.
 */
export async function GET(request: Request) {
  const base = new URL(request.url).origin;

  return NextResponse.json(
    {
      spec: "zakai-agent-authorization",
      version: 1,
      summary:
        "Ask a person to grant your agent scoped, signed, revocable authority that an institution can verify offline.",

      principle:
        "The person grants the authority, never the agent and never us. Nothing is signed until a human has read what is being asked and pressed approve. A mandate minted without a human act is the thing that would make institutions stop honouring all of them.",

      flow: [
        {
          step: 1,
          what: "Register once",
          method: "POST",
          path: "/api/agent/register",
          body: {
            slug: "your-agent",
            name: "Shown to the person",
            description: "One sentence about who you are",
            contact: "you@example.com",
            redirect_uris: ["https://your.app/callback"],
          },
          note: "Lands as pending. A human reviews before you may ask anyone for anything.",
        },
        {
          step: 2,
          what: "Ask for authority",
          method: "POST",
          path: "/api/agent/authorize",
          body: {
            agent: "your-agent",
            scopes: ["read:transactions"],
            purpose: "Why you want it, in words the person will read",
            redirect_uri: "https://your.app/callback",
            state: "opaque value you round-trip",
          },
          returns: { authorize_url: "Send the PERSON here. Nothing else is returned." },
        },
        {
          step: 3,
          what: "The person decides",
          note: "They see your name, your purpose and one line per scope, then approve or refuse. You are not involved.",
        },
        {
          step: 4,
          what: "Exchange the one-time code",
          method: "POST",
          path: "/api/agent/token",
          body: { agent: "your-agent", code: "from the redirect" },
          returns: { mandate: "compact JWS", token_type: "zakai-mandate+jws", expires_in: "seconds" },
          note: "The mandate never travels through the person's browser. The code is single-use and bound to you.",
        },
        {
          step: 5,
          what: "Present it, and let anyone verify it",
          verify: `${base}/api/mandate/verify`,
          jwks: `${base}/.well-known/zakai-jwks.json`,
          revocations: `${base}/api/mandate/revocations`,
          note: "Verification needs no call to us: the JWKS is public and revocation is a signed status list.",
        },
      ],

      limits: {
        max_scopes_per_request: MAX_SCOPES_PER_REQUEST,
        default_grant_seconds: DEFAULT_GRANT_SECONDS,
        max_grant_seconds: MAX_GRANT_SECONDS,
        request_ttl_seconds: Math.floor(REQUEST_TTL_MS / 1000),
        redirect_uri_matching: "exact string, never prefix or wildcard",
      },

      scopes: SCOPES.map((s) => ({
        scope: s.scope,
        tier: s.tier,
        requires_per_act_confirmation: s.perActConfirmation,
        summary: s.summary,
      })),

      /**
       * Published, not merely enforced. An integrator deciding whether to build
       * on this is entitled to know the ceiling before they start, and a
       * promise that is only in the code is a promise nobody can rely on.
       */
      never: {
        scopes: FORBIDDEN_SCOPES,
        why: "This protocol cannot move money outward on anyone's behalf. Not a gap in a list — a property of the design. These are refused at request time and will not be added.",
      },

      revocation:
        "The person can revoke any grant from their authorities screen. Revocation flips a bit in a signed status list every verifier already polls, so it takes effect for everyone, without us contacting anybody.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": cacheControlHeader("catalog"),
      },
    },
  );
}
