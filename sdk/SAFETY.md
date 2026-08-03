# Mandate SDK safety contract

Institutions integrate **verification**, not money movement.

## What the SDKs can do

- Fetch JWKS
- Verify Ed25519 compact JWS Mandates
- Verify signed `statuslist+jwt` revocation lists
- Run published authorization test vectors (`decide`)
- Exit `READY_FOR_PIONEER` when vectors + Status List pass

## What the SDKs cannot do

- Hold or generate private keys
- Issue Mandates
- Initiate payments, transfers, loans, or account open/close
- Invent a permit on crypto or network failure (fail closed)

## Forbidden scopes (always deny)

```
payment:initiate
payment:transfer
credit:borrow
account:open
account:close
investment:trade
```

Source of truth: `sdk/src/scopes.ts` / `zakai_mandate.FORBIDDEN_SCOPES` / production `src/lib/mandate/scopes.ts`.

## Pioneer recognition

Passing test vectors + Status List ⇒ `READY_FOR_PIONEER` ⇒ claim via `/institutions/leader`.  
That is **not** a regulatory license. It is proof you can accept Mandates at the published bar.
