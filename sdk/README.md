# @zakai/mandate-sdk

Official **Node** Mandate verifier for institutions (Python twin: [`sdk/python`](./python)).

**Start here → [`QUICKSTART.md`](./QUICKSTART.md)** (20–30 minutes to `READY_FOR_PIONEER`).  
Safety contract → [`SAFETY.md`](./SAFETY.md) (inbound-only, no outbound money, no private keys).

```bash
cd sdk && npm ci && npm run ready
# → READY_FOR_PIONEER → https://zakai-3uxj.vercel.app/he/institutions/leader
```

Publishing is gated: `.github/workflows/sdk-publish.yml`; npm publish on `sdk@v*` tag
or `workflow_dispatch` with `publish=true`. Until then, use the monorepo path above.

## What you get (minimal surface)

1. **Verify** — `verifyMandateFromUrl` against published JWKS (offline after fetch).
2. **Decide** — `decide()` against [test vectors](https://zakai-3uxj.vercel.app/api/mandate/test-vectors).
3. **Revocation** — `verifyStatusListFromUrl` (`statuslist+jwt`).
4. **Ready gate** — `zakai-mandate-ready` → Pioneer wizard.

Same logic as production Zakai — the SDK cannot silently disagree with the issuer.

## Install

```bash
# Monorepo (works today):
cd sdk && npm ci && npm run build

# After publish:
npm install @zakai/mandate-sdk
npx zakai-mandate-ready
```

## MCP server: give any AI agent a Mandate verifier

The same verification surface, packaged for the protocol agent platforms are
converging on. One command gives an MCP client (Claude, Cursor, or anything
else that speaks MCP) six tools — `verify_mandate`, `decide_action`,
`check_revocation`, `get_trust_registry`, `list_scopes`, and
`predict_outcome` (Oracle; needs `ZAKAI_ORACLE_API_KEY`):

```bash
npm run build && node dist/mcp-bin.js   # or, once published: npx zakai-mandate-mcp
```

```json
{
  "mcpServers": {
    "zakai-mandate": { "command": "zakai-mandate-mcp" }
  }
}
```

Deliberately **verification-only**: the server holds no private keys, cannot
issue mandates, and cannot act on anyone's behalf — the machine equivalent of
reading an ID card, not signing one. Every verification resolves the token's
issuer through the published **trust registry** first: unknown, suspended or
withdrawn issuers are rejected before any cryptography, and an issuer that
granted a scope beyond its registry entry poisons the whole mandate.
`decide_action` additionally checks live revocation at the issuer's own
status route and fails closed: an unreachable status endpoint is a deny,
never a shrug. `ZAKAI_BASE_URL` points it at a staging or self-hosted
registry operator.

## Ready for Pioneer (15 minutes)

```bash
npm run ready
# or: npx zakai-mandate-ready --origin https://zakai-3uxj.vercel.app
```

Runs every published authorization test vector and cryptographically verifies
the signed `statuslist+jwt`. Exit 0 prints `READY_FOR_PIONEER` — then claim a
slot at `/institutions/leader`. Not regulatory certification.

Python (official package):

```bash
cd sdk/python && pip install -e '.[crypto]' && zakai-mandate-ready
```

Legacy shim: `python3 reference/python/zakai_verify.py --ready`

Human twin: `/he/institutions/quickstart`

## Quickstart: verify a mandate someone sent you

```ts
import { verifyMandateFromUrl, verifyStatusListFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(token, {
  audience: "my-institution-id",
  jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
});

const list = await verifyStatusListFromUrl({
  statusListUri: "https://zakai-3uxj.vercel.app/api/mandate/revocations",
  issuer: "https://zakai-3uxj.vercel.app",
  jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
});

console.log(claims.scopes); // ["contract:cancel", "dispute:charge"]
```

## Decide whether a specific act is authorised right now

```ts
import { decide } from "@zakai/mandate-sdk";

const result = decide({
  claims,
  action: "contract:cancel",
  audience: "my-institution-id",
  actConfirmation: "your-own-reference-for-this-specific-request",
  // "unknown" is the honest default — a bank that hasn't checked revocation
  // has not established authority. Pass "active" or "revoked" once you know.
  revocation: "active",
});

if (result.decision === "deny") {
  // result.reason is one value from a closed, versioned set — safe to
  // branch on in production code.
  console.log(result.reason);
} else {
  console.log(result.obligations); // what you must record or notify
}
```

**Deny by default, always.** No path returns `permit` on error, and a
revocation status your side couldn't establish is a denial, not a permit
with a warning attached.

## Produce a settlement record

```ts
import { buildMandateRef, draftDecisionRecord, adjudicate } from "@zakai/mandate-sdk";

const mandateRef = buildMandateRef(claims, token);
const decisionDraft = draftDecisionRecord(mandateRef, {
  institution: "my-institution-id",
  action: "contract:cancel",
  decision: result.decision,
  reason: result.reason,
  actConfirmation: "your-own-reference-for-this-specific-request",
});

// Sign `decisionDraft` with your own key — this package never signs on your
// behalf, because the assertion "we decided this" can only honestly be made
// by the party that decided it.

const verdict = adjudicate({ mandate: mandateRef, decision: decisionDraft });
console.log(verdict.verdict); // e.g. "refused_with_reason" — a real verdict,
                               // derivable from the records alone, with no
                               // human reading a log to settle a dispute.
```

`prevHash` on a decision record is the mandate's own token hash — not a
fresh hash of the reference object. Getting that backwards is invisible
until `adjudicate()` calls the result `broken_chain`; this package's tests
build a real chain end to end specifically to catch that class of mistake
before it ships.

## Verify a candidate issuer's conformance independently

`assessConformance()` in the production app aggregates a candidate's own
*self-reported* pass/fail results — honest, but not independent verification.
`probeIssuer()` closes part of that gap: given a candidate's public JWKS and
one or more sample mandates they issue, it runs an independent judge (this
SDK's own `verifyMandate`) against 7 of the 10 published conformance checks,
without trusting anything the candidate says about their own code.

```ts
import { probeIssuer, assessConformance } from "@zakai/mandate-sdk";

const results = await probeIssuer({
  jwks: candidateJwks,
  audience: "my-institution-id",
  sampleValidToken: candidateSampleToken,
  sampleExpiredToken: candidateExpiredSample, // optional — see below
});

const report = assessConformance(results);
console.log(report.verdict); // "conformant" | "conformant_with_notes" | "not_conformant"
```

Checks it can genuinely settle from artifacts alone: `publishes_jwks` (no
leaked private key material), `issues_valid_jwt`, `registered_claims_present`,
`scope_is_oauth_shaped`, `refuses_forbidden_scope`, `rejects_forged_signature`
(by flipping a bit in the signature's actual decoded bytes — the trailing
characters of a base64url segment can be pure padding, so tampering the text
directly can silently round-trip to the same bytes), and `enforces_audience`.

`enforces_expiry` needs a sample token the candidate issued *already
expired*; if one isn't supplied, `probeIssuer` leaves it out of the results
entirely rather than assuming a pass, and `assessConformance` reports it as
`missing`. Two checks — `publishes_status_list` freshness and
`revocation_takes_effect` — need monitoring over time or a bespoke
issuance-API call this SDK can't assume the shape of, so they're always left
for the registry operator to verify directly rather than faked here.

## Beyond money

The scope vocabulary in `scopes.ts` is finance-shaped, but the underlying
primitive in `domains.ts` is not: *person authorises agent to perform act X
against institution I — verifiably, revocably, within a stated limit.* That
applies identically in health, government, employment, housing and
education. Only finance is live today; the other domains are reserved with
their categorical limits (what an agent may never do in that domain) already
fixed, decided before any sector's first customer could ask for an
exception.

## What this package will never do

- Sign anything on your behalf other than a mandate you are explicitly
  issuing yourself with your own key.
- Let a forbidden scope through under any circumstance — see
  `FORBIDDEN_SCOPES` in `scopes.ts`. There is no code path, error state, or
  version of `decide()` that returns `permit` for one of these, regardless
  of what a token claims.
- Require a live call to Zakai to verify a mandate. `verifyMandate` works
  entirely offline once you have the JWKS.

## Learn more

- **Protocol manifest (start here):** `https://zakai-3uxj.vercel.app/.well-known/zakai-protocol.json`
- **Network feed (outcome graph stats):** `https://zakai-3uxj.vercel.app/api/network`
- Discovery document: `https://zakai-3uxj.vercel.app/.well-known/zakai-mandate.json`
- Trust registry: `https://zakai-3uxj.vercel.app/.well-known/zakai-trust-registry.json`
  (human-readable: `https://zakai-3uxj.vercel.app/en/registry`)
- Conformance suite (for implementing your own verifier in another language):
  `https://zakai-3uxj.vercel.app/.well-known/zakai-conformance.json`
- Institutional integration guide: `https://zakai-3uxj.vercel.app/en/institutions`
- For builders of AI agents specifically (issuing side, not just verifying):
  `https://zakai-3uxj.vercel.app/en/agents`
