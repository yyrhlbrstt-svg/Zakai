/**
 * Institution inbound receive format — the missing half of switching.
 * Banks/providers can implement this without calling Zakai sales.
 */

export const INBOUND_RECEIVE_SPEC = "zakai-inbound-receive";
export const INBOUND_RECEIVE_VERSION = "2026-08-03";

export type InboundReceiveChannel = "https_webhook" | "email_to_desk" | "sftp_batch";

export interface InboundReceiveField {
  name: string;
  required: boolean;
  description: string;
}

/** Canonical JSON body an institution accepts when a consumer Mandate arrives. */
export const INBOUND_RECEIVE_FIELDS: readonly InboundReceiveField[] = [
  {
    name: "mandate_jws",
    required: true,
    description: "Compact JWS (Ed25519) — verify against issuer JWKS from trust registry",
  },
  {
    name: "mandate_jti",
    required: true,
    description: "JWT id for idempotency and revocation checks",
  },
  {
    name: "authorization_code",
    required: false,
    description: "Human-readable ZK-… code when a printable Authorization exists",
  },
  {
    name: "subject_hint",
    required: false,
    description: "Opaque case or correlation id from the sender — not a national ID",
  },
  {
    name: "intent",
    required: true,
    description: "cancel | retention | switch | dispute | information_request",
  },
  {
    name: "vertical",
    required: true,
    description: "telecom | subscription | energy | banking | other",
  },
  {
    name: "locale",
    required: false,
    description: "BCP-47 preferred reply language",
  },
  {
    name: "switching_profile_id",
    required: false,
    description: "Id from zakai-switching.json when applicable",
  },
] as const;

export function buildInboundReceiveDocument(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: INBOUND_RECEIVE_SPEC,
    version: INBOUND_RECEIVE_VERSION,
    name: "Zakai Institution Inbound Receive",
    tagline:
      "One JSON shape for Mandate-backed consumer requests — verify cryptographically, process asynchronously, never require a call centre.",
    channels: ["https_webhook", "email_to_desk", "sftp_batch"] as InboundReceiveChannel[],
    verify: {
      jwks: `${base}/.well-known/zakai-jwks.json`,
      trust_registry: `${base}/.well-known/zakai-trust-registry.json`,
      revocations: `${base}/api/mandate/revocations`,
      verify_api: `${base}/api/mandate/verify`,
      conformance: `${base}/.well-known/zakai-conformance.json`,
    },
    fields: INBOUND_RECEIVE_FIELDS,
    idempotency: {
      header: "Idempotency-Key",
      key_recommendation: "mandate_jti",
    },
    response_codes: {
      "202": "Accepted for async processing",
      "400": "Malformed body",
      "401": "Mandate signature or issuer rejected",
      "409": "Duplicate mandate_jti already processed",
      "422": "Valid Mandate but out of allowed scopes / audience",
    },
    example_post: {
      url: "https://institution.example/webhooks/zakai-inbound",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "<mandate_jti>",
      },
      body: {
        mandate_jws: "<compact-jws>",
        mandate_jti: "…",
        authorization_code: "ZK-XXXX-XXXX",
        intent: "cancel",
        vertical: "subscription",
        locale: "he-IL",
        switching_profile_id: "subscription-cancel-il-1",
      },
    },
    rules: [
      "Never treat an unverified JWS as authority.",
      "Scopes are inbound-only — reject any token that implies outward payment.",
      "Publish your webhook URL on your developer portal; link this spec.",
      "Human Authorization codes are optional convenience, not a substitute for JWKS verify.",
    ],
    related: {
      switching: `${base}/.well-known/zakai-switching.json`,
      institutions: `${base}/he/institutions`,
      leaders: `${base}/he/institutions/leader`,
    },
  };
}
