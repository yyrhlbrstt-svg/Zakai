/**
 * The Zakai Mandate protocol as an MCP server — the adapter that lets any
 * MCP-speaking agent platform (Claude, ChatGPT, Cursor, LangChain, and the
 * long tail converging on the protocol) answer the one question every
 * consumer-facing agent will eventually be asked: *prove this human
 * authorised you to do that.*
 *
 * Deliberately verification-only. The server verifies signatures, checks
 * revocation, and evaluates scope decisions — the machine equivalent of
 * reading an ID card. It cannot issue mandates, cannot act on anyone's
 * behalf, and holds no private keys; issuance stays inside Zakai, behind the
 * principal's own explicit consent. That asymmetry is the legal design, not
 * an implementation gap: a verifier that turns out to be wrong has rejected
 * or accepted a piece of paper, while an issuer that turns out to be wrong
 * has signed away somebody's authority.
 *
 * Every tool is pure with respect to Zakai: nothing here requires an API
 * key, an account, or a network call to any endpoint that is not already
 * public (the JWKS and the revocation status route, both CORS-open by
 * design).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MandateError,
  verifyMandateFromUrl,
  type MandateClaims,
} from "./mandate.js";
import { decide, type RevocationState } from "./decision.js";
import { SCOPES, FORBIDDEN_SCOPES } from "./scopes.js";

export const DEFAULT_BASE_URL = "https://zakai-3uxj.vercel.app";
export const DEFAULT_JWKS_URI = `${DEFAULT_BASE_URL}/.well-known/zakai-jwks.json`;

/** One JSON shape for every outcome, success or failure — agents parse, not read. */
function asText(payload: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function errorPayload(err: unknown): { ok: false; error: string; code: string } {
  if (err instanceof MandateError) {
    return { ok: false, error: err.message, code: err.code };
  }
  return { ok: false, error: err instanceof Error ? err.message : String(err), code: "UNEXPECTED" };
}

/**
 * Fetch live revocation status for a jti from the issuer's public status
 * route. Anything other than a definite answer maps to "unknown", which
 * `decide()` treats as deny — fail closed, never "probably fine".
 */
export async function fetchRevocationState(
  jti: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<{ state: RevocationState; revokedAt?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/mandate/status/${encodeURIComponent(jti)}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { state: "unknown" };
    const body = (await res.json()) as { status?: string; revokedAt?: string };
    if (body.status === "revoked") return { state: "revoked", revokedAt: body.revokedAt };
    if (body.status === "active") return { state: "active" };
    return { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
}

export interface MandateMcpOptions {
  /** Issuer base URL for JWKS + revocation status. Defaults to production Zakai. */
  baseUrl?: string;
}

/**
 * Build the MCP server. Exported as a factory so tests can wire it to an
 * in-memory transport and the bin entry can wire it to stdio.
 */
export function createMandateMcpServer(options: MandateMcpOptions = {}): McpServer {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const jwksUri = `${baseUrl}/.well-known/zakai-jwks.json`;

  const server = new McpServer({
    name: "zakai-mandate",
    version: "0.1.0",
  });

  server.registerTool(
    "verify_mandate",
    {
      title: "Verify a Zakai Mandate",
      description:
        "Cryptographically verify a Zakai Mandate token (Ed25519 JWS) against the issuer's published JWKS and return its claims: who authorised what, for which institution (audience), in which market, valid from/until. Verification only — this does not check revocation; use decide_action for a full permit/deny answer.",
      inputSchema: {
        token: z.string().min(20).describe("The compact JWS mandate token presented to you"),
        audience: z
          .string()
          .min(1)
          .describe("Your own institution id — a mandate addressed to someone else must not verify"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ token, audience }) => {
      try {
        const claims: MandateClaims = await verifyMandateFromUrl(token, { audience, jwksUri });
        return asText({ ok: true, claims });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  server.registerTool(
    "decide_action",
    {
      title: "May this agent do this, now?",
      description:
        "The full authorisation decision for one concrete action under a Zakai Mandate: signature verification, audience/subject/market checks, scope grant + forbidden-scope registry, validity window, live revocation status, and per-act confirmation where the scope requires it. Returns permit with obligations, or deny with a machine-stable reason. Fail-closed: unknown revocation status is a deny, not a warning.",
      inputSchema: {
        token: z.string().min(20).describe("The compact JWS mandate token"),
        audience: z.string().min(1).describe("Your own institution id"),
        action: z
          .string()
          .min(1)
          .describe("The scope being exercised right now, e.g. contract:cancel (see list_scopes)"),
        actConfirmation: z
          .string()
          .optional()
          .describe(
            "Reference to the principal's confirmation of THIS specific act — required by scopes marked perAct in list_scopes",
          ),
        subject: z.string().optional().describe("Expected subject id, if you track one"),
        market: z.string().optional().describe("Your market (ISO country code), if you enforce one"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ token, audience, action, actConfirmation, subject, market }) => {
      try {
        const claims = await verifyMandateFromUrl(token, { audience, jwksUri });
        const revocation = await fetchRevocationState(claims.jti, baseUrl);
        const decision = decide({
          claims,
          action,
          audience,
          subject,
          market,
          actConfirmation,
          revocation: revocation.state,
        });
        return asText({ ok: true, decision, revocation });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  server.registerTool(
    "check_revocation",
    {
      title: "Check mandate revocation status",
      description:
        "Live revocation status for a mandate id (jti) from the issuer's public status route: active, revoked (with timestamp), or unknown. Treat unknown as not-authorised.",
      inputSchema: {
        jti: z.string().min(8).max(128).describe("The mandate's jti claim"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ jti }) => {
      const revocation = await fetchRevocationState(jti, baseUrl);
      return asText({ ok: true, jti, ...revocation });
    },
  );

  server.registerTool(
    "list_scopes",
    {
      title: "List the Mandate scope registry",
      description:
        "The closed set of scopes a Zakai Mandate can carry, each with its risk tier and whether it demands per-act confirmation — plus the forbidden set (outward money movement), which no mandate may ever carry. Scopes are a registry, not free text: an unknown scope is a deny.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      asText({
        ok: true,
        scopes: SCOPES,
        forbidden: FORBIDDEN_SCOPES,
        note: "Forbidden scopes are rejected at issuance AND at decision time; their presence anywhere in a token is itself a deny.",
      }),
  );

  return server;
}
