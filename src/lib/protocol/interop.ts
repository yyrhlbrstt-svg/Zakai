import "server-only";

import { WELL_KNOWN_RELATIVE, absoluteWellKnown, PROTOCOL_LAWS } from "@/lib/protocol/laws";
import { RIGHTS_CATALOG_API_VERSION } from "@/lib/protocol/zml/catalog";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";
import { CHECKS } from "@/lib/mandate/conformance";

export const INTEROP_SPEC = "zakai-interop";
export const INTEROP_VERSION = "2026-08-03";

export type InteropProfileId =
  | "zakai-core-1"
  | "zakai-rights-catalog-1"
  | "zakai-mandate-verifier-1"
  | "zakai-outcome-graph-1"
  | "zakai-pipe-1";

export interface InteropProfileDef {
  id: InteropProfileId;
  title: string;
  summary: string;
  /** Who implements this profile */
  implementer: "any_platform" | "institution" | "issuer" | "researcher";
}

export const INTEROP_PROFILES: readonly InteropProfileDef[] = [
  {
    id: "zakai-core-1",
    title: "Core discovery",
    summary: "Protocol manifest, product laws, and version — the minimum to integrate safely.",
    implementer: "any_platform",
  },
  {
    id: "zakai-rights-catalog-1",
    title: "Rights catalog (ZML)",
    summary: "Machine-readable rights by market without PII — the interchange layer for consumer law.",
    implementer: "any_platform",
  },
  {
    id: "zakai-mandate-verifier-1",
    title: "Mandate verifier",
    summary: "JWKS, trust registry, scopes, and verify API — cryptographic consumer authority inbound-only.",
    implementer: "institution",
  },
  {
    id: "zakai-outcome-graph-1",
    title: "Outcome graph reader",
    summary: "De-identified strategy outcomes — public learning without user records.",
    implementer: "researcher",
  },
  {
    id: "zakai-pipe-1",
    title: "Zakai Pipe (Mandate → SavingsProof rails)",
    summary:
      "Single discovery + accept + handoff + savings ledger — the Visa-style pipe other agents and institutions speak.",
    implementer: "any_platform",
  },
] as const;

export interface InteropProbeCheck {
  id: string;
  profile: InteropProfileId;
  method: "GET" | "OPTIONS";
  path: string;
  expectStatus: number;
  note?: string;
}

/** Live probes run by GET /api/interop?probe=1 — same origin only. */
export const INTEROP_PROBE_CHECKS: readonly InteropProbeCheck[] = [
  { id: "protocol_well_known", profile: "zakai-core-1", method: "GET", path: WELL_KNOWN_RELATIVE.protocol, expectStatus: 200 },
  { id: "protocol_api", profile: "zakai-core-1", method: "GET", path: "/api/protocol", expectStatus: 200 },
  { id: "version", profile: "zakai-core-1", method: "GET", path: "/api/version", expectStatus: 200 },
  { id: "markets", profile: "zakai-rights-catalog-1", method: "GET", path: "/api/markets", expectStatus: 200 },
  { id: "rights_schema", profile: "zakai-rights-catalog-1", method: "GET", path: WELL_KNOWN_RELATIVE.rightsSchema, expectStatus: 200 },
  { id: "rights_catalog_il", profile: "zakai-rights-catalog-1", method: "GET", path: "/api/rights/catalog?market=IL", expectStatus: 200 },
  { id: "rights_openapi", profile: "zakai-rights-catalog-1", method: "GET", path: "/.well-known/zakai-openapi.json", expectStatus: 200 },
  { id: "zml_stats", profile: "zakai-rights-catalog-1", method: "GET", path: "/api/zml/stats", expectStatus: 200 },
  { id: "domains_manifest", profile: "zakai-core-1", method: "GET", path: WELL_KNOWN_RELATIVE.domains, expectStatus: 200 },
  { id: "switching_spec", profile: "zakai-core-1", method: "GET", path: WELL_KNOWN_RELATIVE.switching, expectStatus: 200 },
  { id: "inbound_receive", profile: "zakai-mandate-verifier-1", method: "GET", path: WELL_KNOWN_RELATIVE.inboundReceive, expectStatus: 200 },
  { id: "inbound_receive_ref", profile: "zakai-mandate-verifier-1", method: "GET", path: "/api/institution/inbound-receive", expectStatus: 200 },
  { id: "agent_economy", profile: "zakai-core-1", method: "GET", path: WELL_KNOWN_RELATIVE.agentEconomy, expectStatus: 200 },
  { id: "agents_index", profile: "zakai-pipe-1", method: "GET", path: WELL_KNOWN_RELATIVE.agents, expectStatus: 200 },
  { id: "pipe_well_known", profile: "zakai-pipe-1", method: "GET", path: WELL_KNOWN_RELATIVE.pipe, expectStatus: 200 },
  { id: "pipe_api", profile: "zakai-pipe-1", method: "GET", path: "/api/pipe", expectStatus: 200 },
  { id: "pipe_mark", profile: "zakai-pipe-1", method: "GET", path: "/api/pipe/mark", expectStatus: 200 },
  { id: "pipe_handoff", profile: "zakai-pipe-1", method: "GET", path: "/api/pipe/handoff", expectStatus: 200 },
  { id: "pipe_accept_cors", profile: "zakai-pipe-1", method: "OPTIONS", path: "/api/pipe/accept", expectStatus: 204 },
  { id: "savings_ledger", profile: "zakai-pipe-1", method: "GET", path: "/api/network/savings-ledger", expectStatus: 200 },
  { id: "fairness_certified", profile: "zakai-rights-catalog-1", method: "GET", path: WELL_KNOWN_RELATIVE.fairnessCertified, expectStatus: 200 },
  { id: "fairness_scores", profile: "zakai-rights-catalog-1", method: "GET", path: "/api/fairness/scores?market=IL", expectStatus: 200 },
  { id: "mandate_discovery", profile: "zakai-mandate-verifier-1", method: "GET", path: WELL_KNOWN_RELATIVE.mandate, expectStatus: 200 },
  { id: "jwks", profile: "zakai-mandate-verifier-1", method: "GET", path: WELL_KNOWN_RELATIVE.jwks, expectStatus: 200 },
  { id: "trust_registry", profile: "zakai-mandate-verifier-1", method: "GET", path: WELL_KNOWN_RELATIVE.trustRegistry, expectStatus: 200 },
  { id: "conformance_suite", profile: "zakai-mandate-verifier-1", method: "GET", path: WELL_KNOWN_RELATIVE.conformance, expectStatus: 200 },
  { id: "mandate_scopes", profile: "zakai-mandate-verifier-1", method: "GET", path: "/api/mandate/scopes", expectStatus: 200 },
  { id: "mandate_verify_cors", profile: "zakai-mandate-verifier-1", method: "OPTIONS", path: "/api/mandate/verify", expectStatus: 204 },
  { id: "network_feed", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/network", expectStatus: 200 },
  { id: "network_gravity", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/network/gravity", expectStatus: 200 },
  { id: "network_monopoly", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/network/monopoly", expectStatus: 200 },
  { id: "trillion_gates", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/network/trillion-gates", expectStatus: 200 },
  { id: "indispensability", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/network/indispensability", expectStatus: 200 },
  { id: "packs_manifest", profile: "zakai-rights-catalog-1", method: "GET", path: WELL_KNOWN_RELATIVE.packs, expectStatus: 200 },
  { id: "regulatory_snapshot", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/regulatory/snapshot?market=IL", expectStatus: 200 },
  { id: "collective_summary", profile: "zakai-outcome-graph-1", method: "GET", path: "/api/collective/summary?market=IL", expectStatus: 200 },
] as const;

export interface ProbeResultRow {
  id: string;
  profile: InteropProfileId;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface InteropProfileStatus {
  id: InteropProfileId;
  status: "pass" | "fail";
  failed_checks: string[];
}

export function buildInteropDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: INTEROP_SPEC,
    version: INTEROP_VERSION,
    name: "Zakai Interoperability Standard",
    tagline:
      "Start here: profiles, well-known URLs, and conformance — implement once, verify without a sales call.",
    laws: PROTOCOL_LAWS,
    profiles: INTEROP_PROFILES.map((p) => ({
      ...p,
      probe_ids: INTEROP_PROBE_CHECKS.filter((c) => c.profile === p.id).map((c) => c.id),
    })),
    mandate_conformance: {
      profile: "zakai-mandate-1",
      checks_count: CHECKS.length,
      document: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.conformance),
    },
    zml: {
      version: ZML_VERSION,
      catalog_api_version: RIGHTS_CATALOG_API_VERSION,
      schema: absoluteWellKnown(base, WELL_KNOWN_RELATIVE.rightsSchema),
    },
    well_known: Object.fromEntries(
      Object.entries(WELL_KNOWN_RELATIVE).map(([k, path]) => [k, absoluteWellKnown(base, path)]),
    ),
    api: {
      interop_probe: `${base}/api/interop?probe=1`,
      protocol: `${base}/api/protocol`,
      markets: `${base}/api/markets`,
      domains: `${base}/api/domains`,
      rights_catalog: `${base}/api/rights/catalog`,
      mandate_verify: `${base}/api/mandate/verify`,
      outcome_report: `${base}/api/outcome`,
      network: `${base}/api/network`,
      pipe: `${base}/api/pipe`,
      pipe_accept: `${base}/api/pipe/accept`,
      pipe_handoff: `${base}/api/pipe/handoff`,
      savings_ledger: `${base}/api/network/savings-ledger`,
    },
    sdk: {
      reference: "sdk/",
      npm_name: "@zakai/mandate-sdk",
      mcp_server: "zakai-mandate-mcp",
    },
    rules: [
      "Profiles are additive — implement the minimum set your role needs.",
      "A failed live probe on zakai-core-1 means the deployment is not a valid reference node.",
      "Issuer admission uses zakai-mandate-1 conformance checks, not human code review.",
      "Rights packs cite real law; fabricated eligibility is out of profile.",
    ],
  };
}

export async function runInteropProbe(origin: string): Promise<{
  probed_at: string;
  checks: ProbeResultRow[];
  profiles: InteropProfileStatus[];
}> {
  const base = origin.replace(/\/+$/, "");
  const checks: ProbeResultRow[] = [];

  for (const def of INTEROP_PROBE_CHECKS) {
    const url = `${base}${def.path}`;
    try {
      const res = await fetch(url, { method: def.method, cache: "no-store" });
      checks.push({
        id: def.id,
        profile: def.profile,
        ok: res.status === def.expectStatus,
        status: res.status,
      });
    } catch (err) {
      checks.push({
        id: def.id,
        profile: def.profile,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const profiles: InteropProfileStatus[] = INTEROP_PROFILES.map((p) => {
    const related = checks.filter((c) => c.profile === p.id);
    const failed = related.filter((c) => !c.ok).map((c) => c.id);
    return {
      id: p.id,
      status: failed.length === 0 ? "pass" : "fail",
      failed_checks: failed,
    };
  });

  return { probed_at: new Date().toISOString(), checks, profiles };
}

export function aggregateProfileStatus(checks: readonly ProbeResultRow[]): InteropProfileStatus[] {
  return INTEROP_PROFILES.map((p) => {
    const related = checks.filter((c) => c.profile === p.id);
    const failed = related.filter((c) => !c.ok).map((c) => c.id);
    return {
      id: p.id,
      status: failed.length === 0 ? "pass" : "fail",
      failed_checks: failed,
    };
  });
}
