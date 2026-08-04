/**
 * The Zakai Mandate protocol as an MCP server — the adapter that lets any
 * MCP-speaking agent platform (Claude, ChatGPT, Cursor, LangChain, and the
 * long tail converging on the protocol) answer the one question every
 * consumer-facing agent will eventually be asked: *prove this human
 * authorised you to do that.*
 *
 * Every verification resolves through the published trust registry, not a
 * hardwired key: the token's issuer must be admitted, active, and within its
 * registered scope grant before its signature even matters. That is the
 * network position in one sentence — signatures are checked locally, but
 * *who may issue at all* is answered by the registry Zakai operates.
 *
 * Deliberately verification-only. The server verifies signatures, checks
 * revocation, and evaluates scope decisions — the machine equivalent of
 * reading an ID card. It cannot issue mandates, cannot act on anyone's
 * behalf, and holds no private keys; issuance stays inside Zakai (and its
 * admitted delegated issuers), behind the principal's own explicit consent.
 * That asymmetry is the legal design, not an implementation gap: a verifier
 * that turns out to be wrong has misread a document, while an issuer that
 * turns out to be wrong has signed away somebody's authority.
 *
 * The only tool that touches anything non-public is predict_outcome, which
 * fronts the Oracle (calibrated outcome predictions from Zakai's
 * de-identified outcome graph) and requires the operator's own API key.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MandateError, type MandateClaims } from "./mandate.js";
import { decide, type RevocationState } from "./decision.js";
import { SCOPES, FORBIDDEN_SCOPES } from "./scopes.js";
import {
  REGISTRY_PATH,
  RegistryError,
  fetchTrustRegistry,
  verifyMandateWithRegistry,
  type RegistryIssuer,
} from "./registry.js";
import { statusListRevocationState } from "./statusList.js";

export const DEFAULT_BASE_URL = "https://zakai-3uxj.vercel.app";

/** One JSON shape for every outcome, success or failure — agents parse, not read. */
function asText(payload: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function errorPayload(err: unknown): { ok: false; error: string; code: string } {
  if (err instanceof MandateError || err instanceof RegistryError) {
    return { ok: false, error: err.message, code: err.code };
  }
  return { ok: false, error: err instanceof Error ? err.message : String(err), code: "UNEXPECTED" };
}

function issuerSummary(issuer: RegistryIssuer): Pick<RegistryIssuer, "iss" | "name" | "status"> {
  return { iss: issuer.iss, name: issuer.name, status: issuer.status };
}

/**
 * Fetch live revocation status for a jti from an issuer's public status
 * route. Anything other than a definite answer maps to "unknown", which
 * `decide()` treats as deny — fail closed, never "probably fine".
 */
export async function fetchRevocationState(
  jti: string,
  issuerOrigin: string,
): Promise<{ state: RevocationState; revokedAt?: string }> {
  try {
    const res = await fetch(
      `${issuerOrigin.replace(/\/+$/, "")}/api/mandate/status/${encodeURIComponent(jti)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return { state: "unknown" };
    const body = (await res.json()) as { status?: string; revokedAt?: string };
    if (body.status === "revoked") return { state: "revoked", revokedAt: body.revokedAt };
    if (body.status === "active") return { state: "active" };
    return { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
}

/**
 * Prefer the signed status list when the token embeds `zkm.status` (offline
 * path). Fall back to live `/status/{jti}` for legacy tokens or when the list
 * is unreachable. List saying revoked always wins.
 */
export async function resolveRevocation(
  claims: MandateClaims,
  issuer: Pick<RegistryIssuer, "iss" | "jwksUri" | "statusListUri">,
): Promise<{ state: RevocationState; revokedAt?: string; via: "status_list" | "live_status" }> {
  if (claims.status) {
    const listState = await statusListRevocationState(claims.status, {
      issuer: issuer.iss,
      jwksUri: issuer.jwksUri,
    });
    if (listState === "revoked") return { state: "revoked", via: "status_list" };
    if (listState === "active") return { state: "active", via: "status_list" };
  }

  const issuerOrigin = (() => {
    try {
      return new URL(issuer.iss).origin;
    } catch {
      return issuer.iss.replace(/\/+$/, "");
    }
  })();
  const live = await fetchRevocationState(claims.jti, issuerOrigin);
  return { ...live, via: "live_status" };
}

export interface MandateMcpOptions {
  /** Registry operator base URL. Defaults to production Zakai. */
  baseUrl?: string;
  /** API key for the Oracle prediction tool (ZAKAI_ORACLE_API_KEY). */
  oracleApiKey?: string;
}

/**
 * Build the MCP server. Exported as a factory so tests can wire it to an
 * in-memory transport and the bin entry can wire it to stdio.
 */
export function createMandateMcpServer(options: MandateMcpOptions = {}): McpServer {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const registryUri = `${baseUrl}${REGISTRY_PATH}`;

  const server = new McpServer({
    name: "zakai-mandate",
    version: "0.2.0",
  });

  server.registerTool(
    "verify_mandate",
    {
      title: "Verify a Zakai-format Mandate",
      description:
        "Full network verification of a Mandate token (Ed25519 JWS): resolve its issuer through the published trust registry (unknown, suspended or withdrawn issuers are rejected before any cryptography), verify the signature against that issuer's registered JWKS, confirm every granted scope is within the issuer's registry entry, and check revocation — preferring the signed status list at zkm.status.uri when the token embeds zkm.status.idx, else live GET /api/mandate/status/{jti}. Returns ok:true only when status is active — revoked → REVOKED, unreachable/unknown → STATUS_UNKNOWN (same fail-closed doctrine as POST /api/mandate/verify). For permit/deny on a concrete act, use decide_action.",
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
        // checkStatusList:false — resolveRevocation covers list + live legacy.
        const { claims, issuer } = await verifyMandateWithRegistry(token, {
          audience,
          registryUri,
          checkStatusList: false,
        });
        const revocation = await resolveRevocation(claims, issuer);
        if (revocation.state === "revoked") {
          return asText({
            ok: false,
            code: "REVOKED",
            error: "mandate_revoked",
            jti: claims.jti,
            revokedAt: revocation.revokedAt,
            via: revocation.via,
            issuer: issuerSummary(issuer),
          });
        }
        if (revocation.state !== "active") {
          return asText({
            ok: false,
            code: "STATUS_UNKNOWN",
            error: "revocation_unknown",
            jti: claims.jti,
            via: revocation.via,
            issuer: issuerSummary(issuer),
          });
        }
        return asText({
          ok: true,
          claims,
          issuer: issuerSummary(issuer),
          revocation: { state: "active", via: revocation.via },
        });
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
        "The full authorisation decision for one concrete action under a Mandate: trust-registry resolution of the issuer, signature verification, audience/subject/market checks, scope grant + forbidden-scope registry, validity window, revocation (signed status list when zkm.status is present, else live status route), and per-act confirmation where the scope requires it. Returns permit with obligations, or deny with a machine-stable reason. Fail-closed: unknown revocation status is a deny, not a warning.",
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
        const { claims, issuer } = await verifyMandateWithRegistry(token, {
          audience,
          registryUri,
          checkStatusList: false,
        });
        const revocation = await resolveRevocation(claims, issuer);
        const decision = decide({
          claims,
          action,
          audience,
          subject,
          market,
          actConfirmation,
          revocation: revocation.state,
        });
        return asText({ ok: true, decision, revocation, issuer: issuerSummary(issuer) });
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
        "Live revocation status for a mandate id (jti) from an issuer's public status route. Returns ok:true only for a definite answer (active or revoked). Unreachable or ambiguous status → ok:false code STATUS_UNKNOWN — treat as not-authorised (never ok:true with state unknown). issuerOrigin defaults to the registry operator.",
      inputSchema: {
        jti: z.string().min(8).max(128).describe("The mandate's jti claim"),
        issuerOrigin: z
          .string()
          .url()
          .optional()
          .describe("The issuer's origin (its iss URL); defaults to the registry operator"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ jti, issuerOrigin }) => {
      const revocation = await fetchRevocationState(jti, issuerOrigin ?? baseUrl);
      if (revocation.state !== "active" && revocation.state !== "revoked") {
        return asText({
          ok: false,
          code: "STATUS_UNKNOWN",
          error: "revocation_unknown",
          jti,
          state: "unknown",
        });
      }
      return asText({ ok: true, jti, ...revocation });
    },
  );

  server.registerTool(
    "get_trust_registry",
    {
      title: "Fetch the Mandate trust registry",
      description:
        "The published registry of admitted issuers: who may issue mandates at all, where each issuer's public keys and status list live, which scopes each may grant, and each issuer's current status (active/suspended/withdrawn). Also carries the forbidden-scope set that binds every issuer permanently. This is the document that turns signature verification into network trust.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const registry = await fetchTrustRegistry(registryUri);
        return asText({ ok: true, registryUri, registry });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  server.registerTool(
    "list_scopes",
    {
      title: "List the Mandate scope registry",
      description:
        "The closed set of scopes a Mandate can carry, each with its risk tier and whether it demands per-act confirmation — plus the forbidden set (outward money movement), which no mandate and no issuer may ever carry. Scopes are a registry, not free text: an unknown scope is a deny.",
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

  server.registerTool(
    "predict_outcome",
    {
      title: "Predict a claim outcome (Oracle)",
      description:
        "Calibrated prediction from Zakai's de-identified outcome graph: for a (market, vertical, counterparty), the probability a claim pays, the expected recovery, and the model's measured calibration. Returns `confident: false` when the evidence is too thin to price money against — never a bare number. Requires an Oracle API key (ZAKAI_ORACLE_API_KEY); contact Zakai institutions channel to obtain one.",
      inputSchema: {
        market: z.string().length(2).describe("ISO country code, e.g. IL"),
        vertical: z.string().min(1).max(64).describe("Claim vertical, e.g. subscription"),
        counterparty: z.string().min(1).max(64).describe("The provider/institution the claim is against"),
        rightId: z.string().max(64).optional().describe("Specific right id, when known"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ market, vertical, counterparty, rightId }) => {
      const apiKey = options.oracleApiKey ?? process.env.ZAKAI_ORACLE_API_KEY;
      if (!apiKey) {
        return asText({
          ok: false,
          code: "ORACLE_KEY_REQUIRED",
          error:
            "predict_outcome needs an Oracle API key. Set ZAKAI_ORACLE_API_KEY in this server's environment; keys are issued through Zakai's institutions channel.",
        });
      }
      try {
        const res = await fetch(`${baseUrl}/api/oracle/predict`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ market, vertical, counterparty, rightId }),
        });
        const body = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          return asText({ ok: false, code: `ORACLE_HTTP_${res.status}`, error: body ?? "oracle error" });
        }
        return asText({ ok: true, prediction: body });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  server.registerTool(
    "discover_pipe",
    {
      title: "Discover the Zakai Pipe",
      description:
        "Fetch the live pipe manifest (/.well-known/zakai-pipe.json or /api/pipe): authority accept, agent handoff, savings ledger, and consumer doors. Use this before inventing URLs.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const res = await fetch(`${baseUrl}/api/pipe`, { headers: { accept: "application/json" } });
        const body = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          return asText({ ok: false, code: `PIPE_HTTP_${res.status}`, error: body ?? "pipe error" });
        }
        return asText({ ok: true, pipe: body });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  server.registerTool(
    "pipe_handoff",
    {
      title: "Hand a user into the Zakai closed loop",
      description:
        "PRIMARY distribution tool: POST /api/pipe/handoff and return an attributed consumer URL. LLM proposes; the user must still approve and send the Mandate on Zakai. Never claim a filing from this call alone.",
      inputSchema: {
        agent: z.string().min(1).max(64).describe("Your agent name for attribution"),
        door: z
          .string()
          .min(1)
          .max(64)
          .default("money")
          .describe("Consumer door, e.g. money, cancel, bank-fees, flights"),
        locale: z.enum(["he", "en"]).default("he"),
        campaign: z.string().max(80).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ agent, door, locale, campaign }) => {
      try {
        const res = await fetch(`${baseUrl}/api/pipe/handoff`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ agent, door, locale, campaign }),
        });
        const body = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          return asText({ ok: false, code: `HANDOFF_HTTP_${res.status}`, error: body ?? "handoff error" });
        }
        return asText({
          ok: true,
          handoff: body,
          law: "Open the returned url for the user. Do not claim you filed anything.",
        });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  server.registerTool(
    "pipe_accept",
    {
      title: "Institution one-shot Mandate accept on the pipe",
      description:
        "POST /api/pipe/accept — extract audience from the JWS, verify via trust registry, check revocation, decide permit/deny for one action. For institution/desk agents, not for inventing consumer filings.",
      inputSchema: {
        mandate_jws: z.string().min(20).describe("Compact JWS Mandate token"),
        action: z.string().min(1).describe("Scope being exercised, e.g. contract:cancel"),
        subject: z.string().optional(),
        market: z.string().optional(),
        actConfirmation: z.string().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ mandate_jws, action, subject, market, actConfirmation }) => {
      try {
        const res = await fetch(`${baseUrl}/api/pipe/accept`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            mandate_jws,
            action,
            subject,
            market,
            actConfirmation,
          }),
        });
        const body = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          return asText({ ok: false, code: `ACCEPT_HTTP_${res.status}`, error: body ?? "accept error" });
        }
        return asText({ ok: true, accept: body });
      } catch (err) {
        return asText(errorPayload(err));
      }
    },
  );

  return server;
}
