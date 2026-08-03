import "server-only";
import { prisma } from "@/lib/prisma";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { emailConfigured } from "@/lib/messaging";
import { publicSecurityEmail, publicSupportEmail } from "@/lib/contact";
import { MandateKeyUnavailableError, loadSigningKeyFromEnv } from "@/lib/mandate/mandate";
import { PROTOCOL_LAWS, WELL_KNOWN_RELATIVE, absoluteWellKnown } from "@/lib/protocol/laws";
import { MARKETS } from "@/lib/global/registry";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";

export interface OutcomeGraphPublicStats {
  totalOutcomes: number;
  markets: Array<{
    market: string;
    trials: number;
    paidCount: number;
    winRate: number | null;
    totalRecoveredMinor: number;
  }>;
  updatedAt: string;
}

export async function getOutcomeGraphPublicStats(): Promise<OutcomeGraphPublicStats> {
  const rows = await prisma.strategyOutcome.groupBy({
    by: ["market"],
    _count: { _all: true },
    _sum: { recoveredMinor: true },
  });

  const paidByMarket = await prisma.strategyOutcome.groupBy({
    by: ["market"],
    where: { paid: true },
    _count: { _all: true },
  });
  const paidMap = new Map(paidByMarket.map((r) => [r.market, r._count._all]));

  const markets = rows.map((r) => {
    const trials = r._count._all;
    const paidCount = paidMap.get(r.market) ?? 0;
    return {
      market: r.market,
      trials,
      paidCount,
      winRate: trials > 0 ? paidCount / trials : null,
      totalRecoveredMinor: r._sum.recoveredMinor ?? 0,
    };
  });

  const totalOutcomes = markets.reduce((s, m) => s + m.trials, 0);

  return {
    totalOutcomes,
    markets: markets.sort((a, b) => b.trials - a.trials),
    updatedAt: new Date().toISOString(),
  };
}

function mandateSigningLive(): boolean {
  try {
    loadSigningKeyFromEnv();
    return true;
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) return false;
    return false;
  }
}

export function buildZakaiProtocolDocument(origin: string) {
  const issuer =
    process.env.MANDATE_ISSUER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    origin;

  return {
    spec: "zakai-protocol",
    version: 1,
    name: "Zakai Consumer Recovery Protocol",
    tagline:
      "Cryptographic consumer authority + de-identified outcome graph — verify like Bitcoin, act in-app.",
    thesis:
      "Bitcoin removed the need to trust a central bank to hold scarcity rules. Zakai removes the need to trust a call centre to hold consumer authority: mandates are Ed25519-verifiable, revocable, and scoped; outcomes are public aggregates without identity.",
    issuer,
    interop: {
      entrypoint: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.interop),
      live_probe: `${origin}/api/interop?probe=1`,
      profiles: ["zakai-core-1", "zakai-rights-catalog-1", "zakai-mandate-verifier-1", "zakai-outcome-graph-1"],
    },
    laws: PROTOCOL_LAWS,
    layers: {
      authority: {
        description: "Ed25519 Mandate (JWT) + human Authorization code + JWKS + revocation bitlist",
        mandate_spec: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.mandate),
        jwks: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.jwks),
        trust_registry: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.trustRegistry),
        conformance: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.conformance),
        verify: `${origin}/api/mandate/verify`,
        decide: `${origin}/api/mandate/decide`,
        live: mandateSigningLive(),
      },
      outcome_graph: {
        description:
          "Append-only StrategyOutcome — what strategies paid off, per market/vertical/counterparty, no users",
        report: `${origin}/api/outcome`,
        network_feed: `${origin}/api/network`,
        proofs_wall: `${origin}/he/proofs`,
      },
      settlement: {
        description: "Linked JWT receipts (mandate → decision → outcome) for machine adjudication",
        test_vectors: `${origin}/api/mandate/test-vectors`,
        openapi: `${origin}/api/mandate/openapi.json`,
      },
      consumer_loop: {
        description: "Detect → approve → verify → send → prove → fee on proof → share",
        app: process.env.NEXT_PUBLIC_APP_URL || origin,
        authority_wallet_export: `${origin}/api/authority/wallet-export`,
      },
    },
    operations: {
      payments_live: paymentsFullyLive(),
      email_delivery: emailConfigured(),
      support_email: publicSupportEmail(),
      security_email: publicSecurityEmail(),
    },
    links: {
      version: `${origin}/api/version`,
      institutions: `${origin}/he/institutions`,
      agents: `${origin}/he/agents`,
    },
    license: "Specifications and public endpoints are open for verification; Zakai consumer app is proprietary.",
    zml: {
      version: ZML_VERSION,
      schema: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.rightsSchema),
      rights_catalog: `${origin}/api/rights/catalog`,
      rights_openapi: `${origin}/.well-known/zakai-openapi.json`,
      fairness_scores: `${origin}/api/fairness/scores?market=IL`,
      features: {
        mandate_verify: mandateSigningLive(),
        outcome_graph: true,
        embedded_widget: true,
        collective_auction: false,
        collective_intent: true,
        fairness_scores: true,
        switching_protocol: true,
        regulatory_snapshot: true,
      },
      domains_manifest: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.domains),
      switching_spec: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.switching),
      intelligence: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.intelligence),
      packs_builtin: [...Object.keys(MARKETS), "EU"],
      markets_api: `${origin}/api/markets`,
      global_hub: `${origin}/en/global`,
    },
  };
}

export async function buildNetworkFeed(origin: string) {
  const outcome = await getOutcomeGraphPublicStats();
  const doc = buildZakaiProtocolDocument(origin);
  return {
    spec: "zakai-network",
    version: 1,
    protocol: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.protocol),
    laws: PROTOCOL_LAWS,
    mandate_live: doc.layers.authority.live,
    operations: doc.operations,
    outcome_graph: outcome,
    endpoints: {
      mandate_spec: doc.layers.authority.mandate_spec,
      jwks: doc.layers.authority.jwks,
      outcome_report_post: doc.layers.outcome_graph.report,
      mandate_verify: doc.layers.authority.verify,
    },
    updatedAt: new Date().toISOString(),
  };
}
