import {
  ISSUERS,
  listRegisteredIssuers,
  type AdmissionProblem,
  type RegisteredIssuer,
  validateIssuer,
} from "./trustRegistry";
import { FORBIDDEN_SCOPES, SCOPES } from "./scopes";

/**
 * Conformance package for a second issuer joining the trust registry.
 *
 * Admission itself stays human (`scripts/admit-delegated-pilot.mjs` for
 * delegated keys; env / registry publish for full JWKS issuers). This package
 * lets a candidate prove their row would validate — dry-run only, never mutates
 * production ISSUERS.
 */

export type IssuerEvidenceChecklistItem = {
  id: string;
  title: string;
  probe: string;
  required: boolean;
};

export function issuerEvidenceChecklist(): IssuerEvidenceChecklistItem[] {
  return [
    {
      id: "jwks_https",
      title: "Publish Ed25519 JWKS over HTTPS",
      probe: "GET {jwksUri} returns keys[]; kid matches signing key",
      required: true,
    },
    {
      id: "status_list",
      title: "Publish revocation / status list over HTTPS",
      probe: "GET {statusListUri} is machine-readable; fail-closed on timeout",
      required: true,
    },
    {
      id: "scopes_subset",
      title: "allowedScopes ⊆ known SCOPES and ∉ FORBIDDEN_SCOPES",
      probe: "POST /api/mandate/delegation/evidence with candidate row",
      required: true,
    },
    {
      id: "decide_vectors",
      title: "Pass mandate decision test vectors",
      probe: "GET /api/mandate/test-vectors — reference/go|python zakai_decide",
      required: true,
    },
    {
      id: "settle_vectors",
      title: "Pass settlement canonicalisation + adjudication vectors",
      probe: "GET /api/settlement/test-vectors — reference/go|python zakai_settle",
      required: true,
    },
    {
      id: "inbound_receive",
      title: "Accept structured Mandate inbound (optional for pure issuers)",
      probe: "POST /api/institution/inbound-receive or reference/inbound-receiver",
      required: false,
    },
    {
      id: "interop_g1",
      title: "Keep G1 interop green against production origin",
      probe: "GET /api/interop?probe=1",
      required: true,
    },
  ];
}

export type DryRunResult = {
  ok: boolean;
  problems: AdmissionProblem[];
  would_join_registry: boolean;
  note: string;
  candidate: Pick<
    RegisteredIssuer,
    "iss" | "name" | "jwksUri" | "statusListUri" | "allowedScopes" | "status"
  >;
  against_issuer_count: number;
};

export function dryRunIssuerAdmission(
  candidate: RegisteredIssuer,
  existing: readonly RegisteredIssuer[] = listRegisteredIssuers(),
): DryRunResult {
  const problems = validateIssuer(candidate, existing);
  return {
    ok: problems.length === 0,
    problems,
    would_join_registry: problems.length === 0,
    note:
      "Dry-run only. Passing does not admit the issuer. Full JWKS issuers still need a reviewed ZAKAI_EXTRA_ISSUERS_JSON publish; delegated pilots use scripts/admit-delegated-pilot.mjs after application review.",
    candidate: {
      iss: candidate.iss,
      name: candidate.name,
      jwksUri: candidate.jwksUri,
      statusListUri: candidate.statusListUri,
      allowedScopes: candidate.allowedScopes,
      status: candidate.status,
    },
    against_issuer_count: existing.length,
  };
}

export function issuerEvidencePackage() {
  return {
    version: 1,
    purpose:
      "Evidence package for second-issuer / delegated-pilot admission. Validates candidate rows without mutating the live trust registry.",
    checklist: issuerEvidenceChecklist(),
    endpoints: {
      dry_run: "POST /api/mandate/delegation/evidence",
      package: "GET /api/mandate/delegation/evidence",
      apply_delegated: "POST /api/mandate/delegation/apply",
      trust_registry: "GET /.well-known/zakai-trust-registry.json",
      decide_vectors: "GET /api/mandate/test-vectors",
      settle_vectors: "GET /api/settlement/test-vectors",
      admit_pilot_script: "scripts/admit-delegated-pilot.mjs",
    },
    forbidden_scopes: FORBIDDEN_SCOPES,
    known_scopes: SCOPES.map((s) => s.scope),
    core_issuers: ISSUERS.map((i) => ({ iss: i.iss, status: i.status })),
    registered_issuer_count: listRegisteredIssuers().length,
    example_candidate: {
      iss: "https://issuer.example",
      name: "Example Issuer",
      jwksUri: "https://issuer.example/.well-known/jwks.json",
      statusListUri: "https://issuer.example/api/mandate/revocations",
      allowedScopes: ["read:bills", "dispute:charge"],
      status: "active",
      admittedAt: "2026-08-03",
    } satisfies RegisteredIssuer,
  };
}
