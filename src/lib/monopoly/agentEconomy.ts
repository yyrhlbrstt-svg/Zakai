/**
 * Agent economy — how other AIs become distribution, not competitors.
 */

export function buildAgentEconomyDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: "zakai-agent-economy",
    version: "2026-08-03",
    name: "Zakai Agent Economy",
    tagline:
      "Other agents send users with attribution; Zakai supplies Mandate, ZML, and the closed money loop.",
    laws: [
      "LLM proposes; Zakai executes only after explicit user action.",
      "No outward money-movement Mandate scopes.",
      "Handoffs use utm_source=agent&utm_campaign=agent-<name> (first-touch cookie).",
      "Never invent amounts, eligibility, or claim a filing that was only drafted.",
    ],
    handoff: {
      consumer_must_have: `${base}/he/must-have`,
      money_scan: `${base}/he/money#zakai-money-scan`,
      what_owed: `${base}/he/what-am-i-owed`,
      attribution_query: "?utm_source=agent&utm_campaign=agent-<your-name>",
      llms_txt: `${base}/llms.txt`,
    },
    protocol: {
      mandate_verify: `${base}/api/mandate/verify`,
      jwks: `${base}/.well-known/zakai-jwks.json`,
      inbound_receive: `${base}/.well-known/zakai-inbound-receive.json`,
      zml_catalog: `${base}/api/rights/catalog?market=IL`,
      packs_mirror: `${base}/api/cdn/packs`,
      monopoly_rails: `${base}/api/network/monopoly`,
      trillion_gates: `${base}/api/network/trillion-gates`,
      indispensability: `${base}/api/network/indispensability`,
      fairness_certified: `${base}/.well-known/zakai-fairness-certified.json`,
    },
    delegation: {
      apply: `${base}/api/mandate/delegation/apply`,
      issuers: `${base}/api/mandate/delegation/issuers`,
      mcp: "zakai-mandate-mcp (verify-only)",
    },
    win_condition:
      "A general-purpose agent that skips Mandate cannot close claims institutions will accept — so agents route here.",
  };
}
