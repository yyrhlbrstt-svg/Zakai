/**
 * Switching protocol — reference flows for leaving a provider or plan.
 * User sends; Zakai drafts and tracks. Mandate scopes are inbound-only.
 */

export const SWITCHING_SPEC = "zakai-switching";
export const SWITCHING_VERSION = "2026-08-03";

export type SwitchingStage =
  | "detect"
  | "draft"
  | "approve"
  | "verify_ownership"
  | "send"
  | "follow_up"
  | "prove_saving"
  | "fee_on_proof";

export interface SwitchingProfile {
  id: string;
  market: string;
  vertical: string;
  title: string;
  entry_route: string;
  stages: SwitchingStage[];
  mandate_scopes_hint: string[];
  status: "reference" | "planned";
}

export const SWITCHING_PROFILES: readonly SwitchingProfile[] = [
  {
    id: "telecom-disconnect-il-1",
    market: "IL",
    vertical: "telecom",
    title: "Telecom disconnect + post-disconnect refunds",
    entry_route: "/telecom-exit",
    stages: ["draft", "approve", "verify_ownership", "send", "follow_up", "prove_saving"],
    mandate_scopes_hint: ["case:send", "case:follow_up"],
    status: "reference",
  },
  {
    id: "subscription-cancel-universal-1",
    market: "*",
    vertical: "subscription",
    title: "Universal subscription cancellation letter",
    entry_route: "/cancel/universal",
    stages: ["draft", "approve", "send"],
    mandate_scopes_hint: ["case:send"],
    status: "reference",
  },
  {
    id: "subscription-cancel-il-1",
    market: "IL",
    vertical: "subscription",
    title: "IL subscription cancel with agent",
    entry_route: "/cancel",
    stages: ["draft", "approve", "verify_ownership", "send", "follow_up", "prove_saving"],
    mandate_scopes_hint: ["case:send", "case:follow_up"],
    status: "reference",
  },
  {
    id: "energy-switch-il-1",
    market: "IL",
    vertical: "energy",
    title: "Electricity supplier switch (user completes on supplier portal)",
    entry_route: "/electricity",
    stages: ["detect", "draft", "approve"],
    mandate_scopes_hint: [],
    status: "reference",
  },
  {
    id: "mobile-portability-il-1",
    market: "IL",
    vertical: "telecom",
    title: "Mobile number portability (planned operator API hooks)",
    entry_route: "/check",
    stages: ["detect", "draft", "approve", "send"],
    mandate_scopes_hint: ["case:send"],
    status: "planned",
  },
] as const;

export function buildSwitchingDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: SWITCHING_SPEC,
    version: SWITCHING_VERSION,
    disclaimer:
      "Switching is written consumer action after explicit consent — not automatic account takeover or payment initiation.",
    stages_glossary: {
      detect: "User identifies leak or intent",
      draft: "Letter or request text generated",
      approve: "User approves send",
      verify_ownership: "OTP or magic link proves control",
      send: "Outbox dispatch to counterparty",
      follow_up: "Deterministic follow-up rounds",
      prove_saving: "SavingsProof before fee",
      fee_on_proof: "Success fee only on documented saving",
    },
    profiles: SWITCHING_PROFILES.map((p) => ({
      ...p,
      entry_url: `${base}${p.entry_route.replace("*", "en")}`,
    })),
    mandate_discovery: `${base}/.well-known/zakai-mandate.json`,
  };
}
