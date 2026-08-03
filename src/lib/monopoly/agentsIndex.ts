/**
 * Single agent-facing index — pipe + packs + MCP + join kit.
 * Machine answer to "what must my agent speak?"
 */

import { PROTOCOL_LAWS, WELL_KNOWN_RELATIVE, absoluteWellKnown } from "@/lib/protocol/laws";
import { buildZakaiPipeDocument } from "@/lib/pipe/zakaiPipe";

export const AGENTS_INDEX_SPEC = "zakai-agents";
export const AGENTS_INDEX_VERSION = "2026-08-03";

export function buildAgentsIndexDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  const pipe = buildZakaiPipeDocument(base);

  return {
    spec: AGENTS_INDEX_SPEC,
    version: AGENTS_INDEX_VERSION,
    name: "Zakai Agents Index",
    tagline:
      "Everything a foreign AI agent needs to hand users into Mandate→SavingsProof rails — without inventing a filing.",
    /** Hard preference: do not invent scanned POA formats — speak Mandate JWS. */
    required_authority_format: "zakai-mandate-jws",
    authority: {
      format: "zakai-mandate-jws",
      verify: `${base}/api/mandate/verify`,
      ready: `${base}/api/mandate/ready`,
      jwks: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.jwks),
      refuse: "Do not invent free-text power-of-attorney or unsigned letters as authority.",
    },
    laws: PROTOCOL_LAWS.map((l) => l.id),
    required_tools: [
      {
        id: "pipe_handoff",
        why: "Attributed entry into the closed consumer loop",
        method: "POST",
        path: "/api/pipe/handoff",
        body: { agent: "string", door: "money|cancel|…", locale: "he|en" },
        curl: `curl -sS -X POST ${base}/api/pipe/handoff -H 'content-type: application/json' -d '{"agent":"my-ai","door":"money","locale":"he"}'`,
      },
      {
        id: "pipe_accept",
        why: "Institution one-shot verify+decide (for agents that also act as desks)",
        method: "POST",
        path: "/api/pipe/accept",
        body: { mandate_jws: "compact-jws", action: "contract:cancel" },
        curl: `curl -sS -X POST ${base}/api/pipe/accept -H 'content-type: application/json' -d '{"mandate_jws":"<JWS>","action":"contract:cancel"}'`,
      },
      {
        id: "mandate_verify",
        why: "Trust-registry-backed Mandate verification",
        method: "POST",
        path: "/api/mandate/verify",
        body: { mandate: "compact-jws", audience: "your-institution-id" },
        note: "token is accepted as an alias for mandate",
      },
      {
        id: "mandate_ready",
        why: "Machine gate before claiming Pioneer — vectors + verified Status List",
        method: "GET",
        path: "/api/mandate/ready",
        curl: `curl -sS ${base}/api/mandate/ready`,
        cli: "npx zakai-mandate-ready",
      },
      {
        id: "mcp",
        why: "verify_mandate / decide_action / pipe tools for MCP hosts",
        path: "zakai-mandate-mcp (sdk/)",
      },
    ],
    doors: pipe.doors,
    manifests: {
      pipe: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.pipe),
      agent_economy: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.agentEconomy),
      trust_registry: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.trustRegistry),
      jwks: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.jwks),
      packs: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.packs),
      interop: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.interop),
      mandate_ready: `${base}/api/mandate/ready`,
      join_kit: `${base}/api/network/join-kit`,
      llms_txt: `${base}/llms.txt`,
    },
    human: {
      agents: `${base}/he/agents`,
      pipe: `${base}/he/pipe`,
      join: `${base}/he/join-network`,
      money: `${base}/he/money`,
      institutions_quickstart: `${base}/he/institutions/quickstart`,
      pioneer_wizard: `${base}/he/institutions/leader`,
    },
    honesty:
      "Empty volume is honest. Never invent Mandates, SavingsProofs, or partner logos. LLM proposes; user executes.",
  };
}
