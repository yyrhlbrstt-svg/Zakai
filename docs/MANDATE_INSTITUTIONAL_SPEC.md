# Zakai Mandate — Institutional Integration Spec (v1)

This is the authoritative spec. If the code and this document ever disagree,
that is a bug in whichever one is wrong — file it against both, because an
institution that built against the stale one is not at fault.

## Purpose

Give a bank, insurer, utility, or municipality a way to verify that a consumer
has authorised a digital agent to act on their behalf — for a closed set of
acts, until a given time, and only toward that institution — **without** a live
dependency on Zakai for signature verification.

## Non-goals

- Outbound payments, transfers, borrowing, account open/close, trading
- Replacing regulated open-banking data access (that is a different pipe)
- Requiring the institution to hold a Zakai API key for day-to-day verification

## Token

- Format: a plain JWT. `alg`: EdDSA (Ed25519). `typ`: `JWT`.
  (The pre-JWT envelope, `typ: zakai-mandate+jws`, still verifies — nothing
  already issued is invalidated by the move to JWT.)
- Registered claims stay registered, so a stock JWT library validates them for
  you: `iss`, `aud`, `sub`, `jti`, `iat`, `nbf`, `exp`.
- The grant is `scope` (OAuth 2.0 spelling, space-delimited), so a gateway that
  already speaks OAuth reads it without learning anything Zakai-specific.
- Everything else lives under the private claim `zkm`: `v`, `principal`,
  `market`, `statement`, and — only on a delegated-issuance mandate —
  `onBehalfOf` (see below).

## Verification

1. GET `/.well-known/zakai-jwks.json` and cache.
2. Verify the signature with your existing JWT library: `alg: EdDSA`, your own
   institution id as `audience`, this issuer as `issuer`. Expiry and
   not-before come free from the library.
3. Confirm the issuer is `active` in `/.well-known/zakai-trust-registry.json`,
   and that every requested scope is inside that issuer's `allowed_scopes`.
4. GET `/api/mandate/revocations` (a signed status list; verify once, then
   answer offline) or, for a single lookup, `/api/mandate/status/{jti}` —
   require `active`.
5. Allow only actions covered by `scope`.

Or skip steps 2–5 and call `POST /api/mandate/decide` with the token, your
institution id, and the specific act — it returns `permit`/`deny` and a
closed-set reason. This is the recommended integration: it is the same logic
every institution would otherwise write for itself, tested against published
vectors, and a deny is a normal `200`, not an error.

Discovery document: `/.well-known/zakai-mandate.json` (lists every endpoint
below, plus copy-pasteable verification snippets in Node, Python, Go, curl).

## Delegated issuance

A third-party agent that does not want to run its own Ed25519 key
infrastructure can have Zakai sign mandates on its behalf, for that agent's
own users — whom Zakai has never verified itself. Every such mandate carries
`zkm.onBehalfOf: { agent, name, note }` inside the signed token. Its absence
means first-party: Zakai verified the principal directly, same as every other
mandate in this document.

A delegated issuer never appears in the trust registry — it holds no key and
signs nothing, so `iss` on these mandates is still Zakai's. Check
`zkm.onBehalfOf`, not the issuer list, to find them. Every categorical limit
below still applies to a delegated mandate without exception: a delegated
issuer can never obtain a scope forbidden to anyone, and can never exceed the
specific subset it was admitted for. Admission is not self-service; see
`/en/institutions`.

## Forbidden scopes

Refused for every issuer — first-party or delegated — permanently, and
enforced again at `decide()`, not only at issuance:

```
payment:initiate
payment:transfer
credit:borrow
account:open
account:close
investment:trade
```

Finance is the only domain issuable today. `health`, `government`,
`employment`, `housing` and `education` are **reserved**: their own
categorical prohibitions (e.g. `treatment:consent`, `benefits:apply`) are
already published and enforced in code before any customer in those sectors
exists, specifically so a limit is never something negotiated after the first
customer asks for an exception.

## Settlement: what happened, not only who could act

Authorization answers who may act. It does not settle what happened, or who
is right when the institution, the agent, and the consumer disagree
afterward. Each act can produce a chain of three signed statements — the
mandate, the institution's decision, and the outcome — each carrying a hash
of the one before it, each signed only by the party making that claim.
Adjudication is a pure function of the chain, so it yields the same answer for
the institution, the consumer, a regulator, or a court, months later, with no
participant able to fabricate a link.

Verdicts: `performed_as_authorized`, `authorized_not_performed`,
`refused_with_reason`, `unauthorized`, `exceeded_scope`,
`outside_mandate_window`, `broken_chain`, `indeterminate` (a real verdict, not
a failure — a procedure that always names a winner will eventually invent
one). Test vectors: `/api/settlement/test-vectors`.

## Conformance, not just documentation

A specification only its author has implemented is an API with documentation.
Two things make this one checkable instead:

- **Test vectors** (`/api/mandate/test-vectors`, `/api/settlement/test-vectors`)
  — deterministic fixtures with a fixed key, fixed timestamps, covering every
  decision outcome including the orderings where two rules could both fire.
  The signing key in the mandate vectors is published on purpose, exactly as
  RFC test vectors publish theirs; its issuer sits under `.invalid` and has no
  trust-registry entry, so no conforming verifier will ever accept a mandate
  signed with it for real.
- **Reference implementations** — the decision layer (`decide()`), zero
  dependencies, in Python, Go, Java, Ruby and PHP (`/reference` in this
  repository), all agreeing with the TypeScript original on every vector.
  Writing them found real bugs in the spec's first draft; that is the point
  of writing them, not a defect in the exercise.

## Versioning and stability

This is the commitment that makes the difference between "an API we could
change on you" and infrastructure you can build against:

- `zkm.v` is the schema version. **`v: 1` claims are additive-only**: a new
  optional field (like `onBehalfOf`) can appear without a version bump, and a
  verifier that ignores fields it does not recognise keeps working. A version
  bump is reserved for a change that would alter the meaning of an existing
  field or the outcome of a verification a working integration already
  performs.
- **No field is ever repurposed.** A claim name is retired, never redefined —
  the failure mode a version number cannot protect you from is the same name
  meaning something different depending on when the token was issued.
- **Forbidden scopes only grow.** A scope may move from permitted to
  forbidden; the reverse never happens without a major version, because that
  direction is the one that could silently widen authority an institution
  already granted.
- Deprecation of an old version, once `v: 2` exists, carries a minimum
  **180-day** overlap window before `v: 1` verification stops being supported
  in the reference material, published here when it is scheduled.

## Human fallback

Legacy human-readable authorisation codes remain available at `/verify` for
staff who are not yet on the machine path.
