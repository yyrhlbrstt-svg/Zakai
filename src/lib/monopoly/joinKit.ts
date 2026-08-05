/**
 * Single machine-readable kit for institutions, issuers, and agents to join
 * the Mandate / ZML network without a sales call.
 *
 * Does not admit anyone. Does not invent verifiers or scores.
 */

export type JoinAudience = "institution" | "issuer" | "agent" | "developer";

export function buildJoinKitDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: "zakai-network-join-kit",
    version: "2026-08-03",
    name: "Zakai Network Join Kit",
    tagline:
      "Install once: verify Mandate inbound, load ZML packs, or issue under the trust registry. No callback team.",
    honesty:
      "This kit is adoptability infrastructure. Listing as a Reference Verifier or second issuer still requires a real institution and human admission — never auto-filled logos.",
    audiences: {
      institution: {
        goal: "Accept structured Mandate inbound so ignore-cost becomes real (G3).",
        steps: [
          "GET /.well-known/zakai-pipe.json — single rails discovery",
          "POST /api/pipe/accept with mandate_jws + action (one-shot verify/decide)",
          "Run reference/inbound-receiver or POST /api/institution/inbound-receive",
          "Publish acceptor mark: GET /api/pipe/mark",
          "Complete /he/institutions/leader readiness self-test",
          "Opt into public listing via POST /api/institution/reference-verifiers",
          "Measure pressure at /api/institution/inbound-pressure and /api/institution/ignore-cost",
        ],
        urls: {
          human: `${base}/he/institutions/leader`,
          pipe: `${base}/he/pipe`,
          pipe_manifest: `${base}/.well-known/zakai-pipe.json`,
          pipe_accept: `${base}/api/pipe/accept`,
          pipe_mark: `${base}/api/pipe/mark`,
          leaders_wall: `${base}/he/institutions/leaders`,
          inbound_spec: `${base}/.well-known/zakai-inbound-receive.json`,
          inbound_receive: `${base}/api/institution/inbound-receive`,
          reference_clone: `${base}/reference/inbound-receiver/`,
          pilot_package: `${base}/api/institution/pilot-package`,
          ignore_cost: `${base}/api/institution/ignore-cost`,
        },
      },
      issuer: {
        goal: "Become issuer #2+ so the registry is a network, not a vendor API (G5).",
        steps: [
          "Dry-run candidate row: POST /api/mandate/delegation/evidence",
          "Or apply delegated path: POST /api/mandate/delegation/apply",
          "Pass decide + settle vectors (reference/go|python)",
          "Human admission: POST /api/mandate/delegation/issuers (delegated) or POST /api/mandate/registry/issuers (full JWKS issuer) — both admin token, after review",
          "Sandbox demos: GET /api/mandate/sandbox-issuer (never greens G5)",
        ],
        urls: {
          evidence: `${base}/api/mandate/delegation/evidence`,
          apply: `${base}/api/mandate/delegation/apply`,
          sandbox: `${base}/api/mandate/sandbox-issuer`,
          trust_registry: `${base}/.well-known/zakai-trust-registry.json`,
          decide_vectors: `${base}/api/mandate/test-vectors`,
          settle_vectors: `${base}/api/settlement/test-vectors`,
        },
      },
      agent: {
        goal: "Route users with attribution; verify Mandates via MCP — do not fake filings (G8).",
        steps: [
          "PRIMARY: POST /api/pipe/handoff { agent, door, locale } → open returned url",
          "Discover doors: GET /api/pipe/handoff or /.well-known/zakai-agents.json",
          "Fallback UTM: /he/must-have?utm_source=agent&utm_campaign=agent-<name>",
          "Install zakai-mandate-mcp (verify + pipe_handoff + pipe_accept)",
          "Optional: partner embed with durable WidgetKey",
        ],
        urls: {
          pipe_handoff: `${base}/api/pipe/handoff`,
          pipe_manifest: `${base}/.well-known/zakai-pipe.json`,
          agents_index: `${base}/.well-known/zakai-agents.json`,
          economy: `${base}/.well-known/zakai-agent-economy.json`,
          must_have: `${base}/he/must-have`,
          llms: `${base}/llms.txt`,
          mcp: "sdk/ — bin zakai-mandate-mcp",
          widget_validate: `${base}/api/widget/validate`,
        },
      },
      developer: {
        goal: "Load rights as data from CDN/mirror; evaluate offline (G2).",
        steps: [
          "GET /api/cdn/packs/manifest.json then {market}/index.json",
          "Follow docs/ZML_SDK_INTEGRATION.md (30-minute path)",
          "npm run verify:packs-cdn against your mirror",
        ],
        urls: {
          packs_mirror: `${base}/api/cdn/packs`,
          packs_discovery: `${base}/.well-known/zakai-packs.json`,
          catalog: `${base}/api/rights/catalog?market=IL`,
          zml_docs:
            "https://github.com/yyrhlbrstt-svg/Zakai/blob/main/docs/ZML_SDK_INTEGRATION.md",
        },
      },
    } satisfies Record<
      JoinAudience,
      { goal: string; steps: string[]; urls: Record<string, string> }
    >,
    gates: {
      meter: `${base}/api/network/trillion-gates`,
      indispensability: `${base}/api/network/indispensability`,
      interop: `${base}/api/interop`,
      fairness_certified: `${base}/.well-known/zakai-fairness-certified.json`,
      regulatory_brief: `${base}/api/regulatory/snapshot?market=IL&format=brief`,
    },
    human_pages: {
      join: `${base}/he/join-network`,
      institutions: `${base}/he/institutions`,
      partners: `${base}/he/partners`,
      fairness_certified: `${base}/he/fairness-certified`,
      must_have: `${base}/he/must-have`,
      regulatory: `${base}/he/regulatory`,
    },
  };
}
