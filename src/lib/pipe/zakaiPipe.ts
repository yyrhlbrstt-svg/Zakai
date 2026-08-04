import { PROTOCOL_LAWS, WELL_KNOWN_RELATIVE, absoluteWellKnown } from "@/lib/protocol/laws";

/**
 * The Zakai Pipe — single discovery document for the rails.
 * Mandate in → written act → SavingsProof out. Everything else hangs off this.
 */

export const PIPE_SPEC = "zakai-pipe";
export const PIPE_VERSION = "2026-08-03";

/** Consumer doors foreign agents may hand into — keep aligned with embed paths. */
const DOORS = [
  "money",
  "cancel",
  "cancel/universal",
  "bank-fees",
  "electricity",
  "leaks",
  "what-am-i-owed",
  "check",
  "refund-chase",
  "flights",
  "deposit",
  "duplicate-insurance",
  "arnona",
  "warranty",
  "parking",
  "must-have",
  "start",
  "global",
  "rights",
] as const;

export type PipeDoor = (typeof DOORS)[number];

export function isPipeDoor(v: string): v is PipeDoor {
  return (DOORS as readonly string[]).includes(v);
}

export function buildZakaiPipeDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");

  return {
    spec: PIPE_SPEC,
    version: PIPE_VERSION,
    name: "Zakai Pipe",
    tagline:
      "The consumer-money rails: signed Mandate in, documented SavingsProof out. No callback.",
    thesis:
      "Banks, telecoms, utilities, and other AIs do not need another app — they need one pipe that proves authority and records outcomes. This is that pipe.",
    laws: PROTOCOL_LAWS,
    rails: {
      authority: {
        role: "Prove a consumer authorised a scoped inbound act",
        jwks: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.jwks),
        trust_registry: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.trustRegistry),
        mandate_spec: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.mandate),
        verify: `${base}/api/mandate/verify`,
        decide: `${base}/api/mandate/decide`,
        /** Machine gate: vectors + Status List → ready_for_pioneer. */
        ready: `${base}/api/mandate/ready`,
        /** One-shot: extract aud → verify → decide → revocation. */
        accept: `${base}/api/pipe/accept`,
        /** Public mark institutions can link when they process Mandates. */
        acceptor_mark: `${base}/api/pipe/mark`,
        status_template: `${base}/api/mandate/status/{jti}`,
        conformance_probe: `${base}/api/mandate/conformance/probe`,
        openapi: `${base}/api/mandate/openapi.json`,
      },
      intake: {
        role: "Institution receives Mandate-backed request (inbound-only — they never call us back)",
        spec: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.inboundReceive),
        reference_post: `${base}/api/institution/inbound-receive`,
        clone: `${base}/reference/inbound-receiver/`,
        pilot_package: `${base}/api/institution/pilot-package`,
      },
      outcomes: {
        role: "Append-only proof that money moved — the only institutional marketing that compounds",
        savings_ledger: `${base}/api/network/savings-ledger`,
        proofs_wall: `${base}/he/proofs`,
        outcome_report: `${base}/api/outcome`,
        network_feed: `${base}/api/network`,
      },
      agents: {
        role: "Foreign AIs hand users into the closed loop with attribution",
        economy: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.agentEconomy),
        handoff: `${base}/api/pipe/handoff`,
        agents_index: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.agents),
        mcp: "zakai-mandate-mcp (verify + pipe_handoff + pipe_accept + discover_pipe)",
        sdk: `${base.replace(/\/$/, "")}/` + "sdk/ (monorepo) → @zakai/mandate-sdk",
        join_kit: `${base}/api/network/join-kit`,
      },
    },
    human: {
      pipe: `${base}/he/pipe`,
      institutions: `${base}/he/institutions`,
      agents: `${base}/he/agents`,
      money: `${base}/he/money`,
      integrations: `${base}/he/integrations`,
    },
    integrator_minutes: [
      {
        who: "institution",
        steps: [
          `GET ${absoluteWellKnown(base, WELL_KNOWN_RELATIVE.jwks)}`,
          `POST ${base}/api/pipe/accept with mandate_jws + action`,
          `Clone ${base}/reference/inbound-receiver/ or POST inbound-receive`,
        ],
      },
      {
        who: "foreign_agent",
        steps: [
          `POST ${base}/api/pipe/handoff { agent, door }`,
          "Send user to returned url (attribution cookie)",
          "User completes Mandate → SENT → SavingsProof on Zakai rails",
        ],
      },
    ],
    doors: [...DOORS],
    related: {
      protocol: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.protocol),
      interop: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.interop),
      this_manifest: absoluteWellKnown(base, "/.well-known/zakai-pipe.json"),
      api: `${base}/api/pipe`,
    },
  };
}

export function buildHandoffUrl(input: {
  origin: string;
  locale: "he" | "en";
  door: PipeDoor;
  agent: string;
  campaign?: string;
}): string {
  const base = input.origin.replace(/\/+$/, "");
  const agent = input.agent
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 64);
  const campaign = (input.campaign?.trim() || `agent-${agent || "unknown"}`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 80);
  const q = new URLSearchParams({
    utm_source: "agent",
    utm_campaign: campaign,
    utm_medium: "pipe_handoff",
  });
  if (agent) q.set("ref_agent", agent);
  return `${base}/${input.locale}/${input.door}?${q.toString()}`;
}
