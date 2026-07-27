# Zakai Mandate — Institutional Integration Spec (v1)

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

- Format: compact JWS
- `alg`: EdDSA (Ed25519)
- `typ`: `zakai-mandate+jws`
- Claims include: `jti`, `iss`, `aud`, `sub`, `principal`, `scopes`, `market`,
  `iat`, `nbf`, `exp`, `statement`, `v`

## Verification

1. GET `/.well-known/zakai-jwks.json` and cache
2. Verify signature with the matching `kid`
3. Assert `aud` equals your institution identifier
4. Assert time validity (`nbf` / `exp`)
5. GET `/api/mandate/status/{jti}` — require `status: "active"`
6. Allow only actions covered by `scopes`

Discovery document: `/.well-known/zakai-mandate.json`

## Forbidden scopes

```
payment:initiate
payment:transfer
credit:borrow
account:open
account:close
investment:trade
```

## Why institutions can adopt this

A Mandate that cannot spend is a different risk object from one that can.
Compromise yields unwanted correspondence, not theft. Signature correctness is
offline; revocation is a thin online check (same split as cert expiry + OCSP).

## Human fallback

Legacy human-readable authorisation codes remain available at `/verify` for
staff who are not yet on the machine path.
