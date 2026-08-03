/**
 * Five infrastructure domains — machine-readable map of what Zakai publishes.
 * Honest status: live / beta / planned. No inflated traction claims.
 */

import { WELL_KNOWN_RELATIVE, absoluteWellKnown } from "@/lib/protocol/laws";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";

export const DOMAINS_SPEC = "zakai-domains";
export const DOMAINS_VERSION = "2026-08-03";

export type DomainStatus = "live" | "beta" | "planned";

export interface ZakaiDomainDef {
  id: string;
  name: string;
  tagline: string;
  status: DomainStatus;
  honesty: string;
  endpoints: Record<string, string>;
  reference_routes?: string[];
}

export function buildDomainsDocument(origin: string): {
  spec: string;
  version: string;
  interop: string;
  domains: ZakaiDomainDef[];
  laws_url: string;
} {
  const base = origin.replace(/\/+$/, "");
  const wk = (path: string) => absoluteWellKnown(base, path);

  const domains: ZakaiDomainDef[] = [
    {
      id: "pipe",
      name: "Zakai Pipe (Mandate → SavingsProof)",
      tagline:
        "The rails every bank, telecom, utility, and foreign AI must eventually speak — signed authority in, documented outcomes out.",
      status: "live",
      honesty:
        "Architecture is live; gravity_tier stays empty until real SENT/SavingsProof volume with SMTP. No invented partners.",
      endpoints: {
        manifest: wk(WELL_KNOWN_RELATIVE.pipe),
        live: `${base}/api/pipe`,
        accept: `${base}/api/pipe/accept`,
        handoff: `${base}/api/pipe/handoff`,
        mark: `${base}/api/pipe/mark`,
        agents_index: wk(WELL_KNOWN_RELATIVE.agents),
        agent_economy: wk(WELL_KNOWN_RELATIVE.agentEconomy),
        join_kit: `${base}/api/network/join-kit`,
        monopoly: `${base}/api/network/monopoly`,
        savings_ledger: `${base}/api/network/savings-ledger`,
      },
      reference_routes: ["/pipe", "/agents", "/join-network", "/institutions"],
    },
    {
      id: "zml",
      name: "Consumer rights language (ZML)",
      tagline: "Interchange format for rights — cite law, evaluate predicates, act in-app.",
      status: "live",
      honesty:
        "Rights counts are per deployed catalog, not a marketing target. Contribute packs via docs/COUNTRY_PACKS.md.",
      endpoints: {
        schema: wk(WELL_KNOWN_RELATIVE.rightsSchema),
        catalog: `${base}/api/rights/catalog`,
        markets: `${base}/api/markets`,
        stats: `${base}/api/zml/stats`,
        packs_manifest: wk(WELL_KNOWN_RELATIVE.packs),
        openapi: `${base}/.well-known/zakai-openapi.json`,
      },
      reference_routes: ["/rights", "/global"],
    },
    {
      id: "fairness_score",
      name: "Fairness score",
      tagline: "Documented win rate per provider from de-identified outcomes — not reviews.",
      status: "live",
      honesty: `Scores appear only after MIN_SAMPLE observations per provider; empty is honest.`,
      endpoints: {
        scores: `${base}/api/fairness/scores`,
        companies: `${base}/he/companies`,
        widget: `${base}/widget/zakai-widget.js`,
      },
      reference_routes: ["/companies"],
    },
    {
      id: "switching_protocol",
      name: "Switching protocol",
      tagline: "Mandate-scoped written switching — draft, approve, send, prove.",
      status: "beta",
      honesty:
        "Full instant switching is vertical-specific; IL telecom disconnect and universal cancel are reference flows today.",
      endpoints: {
        spec: wk(WELL_KNOWN_RELATIVE.switching),
        mandate: wk(WELL_KNOWN_RELATIVE.mandate),
      },
      reference_routes: ["/telecom-exit", "/cancel", "/cancel/universal", "/electricity"],
    },
    {
      id: "regulatory_intelligence",
      name: "Regulatory intelligence",
      tagline: "De-identified aggregates for supervisors — dashboards, not legal advice.",
      status: "beta",
      honesty:
        "Not regulatory filings or total market volume — only documented Zakai consumer outbound cases and outcomes.",
      endpoints: {
        snapshot: `${base}/api/regulatory/snapshot`,
        inbound_pressure: `${base}/api/institution/inbound-pressure`,
        ignore_cost: `${base}/api/institution/ignore-cost`,
        network_gravity: `${base}/api/network/gravity`,
        network_monopoly: `${base}/api/network/monopoly`,
        trillion_gates: `${base}/api/network/trillion-gates`,
        indispensability: `${base}/api/network/indispensability`,
        fairness_certified: wk(WELL_KNOWN_RELATIVE.fairnessCertified),
        outcome_graph: `${base}/api/network`,
        network_proof: `${base}/he/network-proof`,
      },
      reference_routes: ["/network-proof", "/institutions", "/regulatory", "/companies"],
    },
    {
      id: "collective_intent",
      name: "Collective intent",
      tagline: "Anonymous demand signals for future group pricing — no auction yet.",
      status: "beta",
      honesty:
        "Phase 0: public counts only. No PII, no binding offers, no insurance sales.",
      endpoints: {
        signal: `${base}/api/collective/intent`,
        summary: `${base}/api/collective/summary`,
      },
      reference_routes: ["/money", "/what-am-i-owed"],
    },
    {
      id: "autopilot",
      name: "Self-updating autopilot",
      tagline: "Law watcher, price sentinel, outcome stats, market expander — human gates on law.",
      status: "beta",
      honesty:
        "Does not auto-merge ZML or post to TikTok; opens maintainer tasks and logs findings.",
      endpoints: {
        manifest: `${base}/.well-known/zakai-autopilot.json`,
        status: `${base}/api/autopilot/status`,
        cron: `${base}/api/cron/autopilot`,
      },
      reference_routes: ["/domains", "/standard"],
    },
  ];

  return {
    spec: DOMAINS_SPEC,
    version: DOMAINS_VERSION,
    interop: wk(WELL_KNOWN_RELATIVE.interop),
    laws_url: wk(WELL_KNOWN_RELATIVE.protocol),
    domains,
  };
}

export const ZML_DOMAIN_ID = "zml";
