# @zakai/mandate-sdk

The reference client for the **Zakai Mandate** protocol — a signed, scoped,
audience-bound, revocable statement that a named person authorised an agent
to act on their behalf, plus the settlement layer that decides who is right
when the agent and the institution later disagree about what happened.

Not published to npm yet. This package builds, typechecks, and passes its
full test suite (including a live round trip against a real generated key)
inside the Zakai repository — publishing it under a real package name is a
deliberate, separate step, not something done silently.

## Why this exists

Every agentic product on the market today can *act* for a user — draft a
letter, negotiate a price, fill a form. None of that is worth building a
moat on: it commoditises the moment a better model ships. What every one of
those agents will eventually need, and what almost nobody has built, is a
cheap way to **prove to a third party that the act was authorised** — and,
when the third party disputes it, a **neutral record of who is right** that
doesn't require either side to be trusted.

That is what this package gives you, in the order you'll probably need it:

1. **Verify** a mandate someone presented to you — three lines, against a
   published JWKS, no live call to Zakai required.
2. **Decide** whether a specific act is authorised right now — the ~50 lines
   of scope-matching, audience-checking, per-act-confirmation logic every
   integrator writes slightly differently and usually gets one rule wrong.
   Written once here, pass/fail against
   [published test vectors](https://zakai-3uxj.vercel.app/api/mandate/test-vectors).
3. **Settle** — if you want a durable, disputable record of that decision
   (and later, what actually happened), build one with two helper functions
   and hand the result to `adjudicate()`.

Every function in this package is ported from the production Zakai app, not
reimplemented against a spec describing it. The SDK and the servers it talks
to cannot silently disagree about what a mandate means, because they run
the same logic.

## Install

```bash
npm install @zakai/mandate-sdk
```

(Not on npm yet — see the note at the top of this file.)

## Quickstart: verify a mandate someone sent you

```ts
import { verifyMandateFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(token, {
  audience: "my-institution-id",
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

- Discovery document: `https://zakai-3uxj.vercel.app/.well-known/zakai-mandate.json`
- Trust registry: `https://zakai-3uxj.vercel.app/.well-known/zakai-trust-registry.json`
- Conformance suite (for implementing your own verifier in another language):
  `https://zakai-3uxj.vercel.app/.well-known/zakai-conformance.json`
- Institutional integration guide: `https://zakai-3uxj.vercel.app/en/institutions`
- For builders of AI agents specifically (issuing side, not just verifying):
  `https://zakai-3uxj.vercel.app/en/agents`
