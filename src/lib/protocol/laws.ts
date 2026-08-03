/**
 * Immutable product laws — the "consensus rules" of the Zakai protocol.
 * Machine-readable so integrators and regulators can audit intent without reading all of src/.
 */
export const PROTOCOL_LAWS = [
  {
    id: "fee_on_proof_only",
    summary:
      "Success fees are charged only after a documented SavingsProof (before/after in minor units).",
  },
  {
    id: "no_outbound_money_scopes",
    summary:
      "Mandate scopes are inbound-only; forbidden scopes cannot be issued (no payment:initiate outward).",
  },
  {
    id: "deidentified_outcomes",
    summary:
      "StrategyOutcome rows are append-only and never reference User or Case (public learning without PII).",
  },
  {
    id: "human_gate_execute",
    summary: "Models propose text; the application sends only after explicit user approval and verification.",
  },
  {
    id: "verify_dont_trust",
    summary:
      "Institutions verify mandates via JWKS and revocation status — authority is cryptographic, not a call centre.",
  },
  {
    id: "integer_money",
    summary: "All money fields use integer minor units (agorot); no floating-point fees.",
  },
] as const;

export type ProtocolLawId = (typeof PROTOCOL_LAWS)[number]["id"];

export const WELL_KNOWN_RELATIVE = {
  protocol: "/.well-known/zakai-protocol.json",
  rightsSchema: "/.well-known/zakai-rights-schema.json",
  mandate: "/.well-known/zakai-mandate.json",
  jwks: "/.well-known/zakai-jwks.json",
  trustRegistry: "/.well-known/zakai-trust-registry.json",
  conformance: "/.well-known/zakai-conformance.json",
  interop: "/.well-known/zakai-interop.json",
  domains: "/.well-known/zakai-domains.json",
  packs: "/.well-known/zakai-packs.json",
  switching: "/.well-known/zakai-switching.json",
  inboundReceive: "/.well-known/zakai-inbound-receive.json",
  agentEconomy: "/.well-known/zakai-agent-economy.json",
  autopilot: "/.well-known/zakai-autopilot.json",
  intelligence: "/.well-known/zakai-intelligence.json",
} as const;

export function absoluteWellKnown(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, "")}${path}`;
}
