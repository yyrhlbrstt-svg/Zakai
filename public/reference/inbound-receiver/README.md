# Zakai inbound receiver (reference)

Clone this folder into your bank/provider stack. It implements
`/.well-known/zakai-inbound-receive.json` without calling Zakai sales.

## Contract

1. Accept `POST` JSON with required fields: `mandate_jws`, `mandate_jti`, `intent`, `vertical`.
2. Set `Idempotency-Key` header = `mandate_jti`.
3. Verify the compact JWS against the issuer JWKS from the trust registry.
4. Reject forbidden outward-money scopes.
5. Return `202` when accepted for async processing; `409` on duplicate `jti`.

## Live reference

Zakai hosts a demo at `POST /api/institution/inbound-receive` (same origin as the app).
Use it to test attachments from real Outbox emails — do not rely on it in production.

## Minimal Node example

See `receive.mjs` — zero framework, Node 18+.

## Minimal Python example

See `receive.py` — stdlib only.
