# Zakai Interoperability Standard

**Start here:** `/.well-known/zakai-interop.json`

This is the admission layer for the whole stack — Mandate authority, ZML rights catalog, and the de-identified outcome graph. Implementers do not need a sales call; they need this document and a green probe.

## Why it exists

Standards win when strangers can implement, verify, and join without meetings. Zakai separates:

| Layer | Profile | What you get |
|-------|---------|----------------|
| Discovery | `zakai-core-1` | Laws, protocol manifest, version |
| Rights | `zakai-rights-catalog-1` | ZML schema, markets API, catalog |
| Authority | `zakai-mandate-verifier-1` | JWKS, trust registry, verify, conformance suite |
| Learning | `zakai-outcome-graph-1` | Network feed (de-identified outcomes) |

Issuers additionally implement **`zakai-mandate-1`** checks from `/.well-known/zakai-conformance.json`.

## Live verification

```bash
curl -sS "$ORIGIN/api/interop?probe=1" | jq '.reference_node, .live.profiles'
node scripts/verify-interop.mjs "$ORIGIN"
```

HTTP **200** + `reference_node: true` means the deployment is a valid **reference node** (all profiles pass).

HTTP **503** lists which checks failed — fix or do not claim compatibility.

## Reference SDK

- TypeScript: `sdk/` (`@zakai/mandate-sdk`) — verify, decide, settlement records
- MCP: verification-only server for AI platforms
- `fetchZakaiProtocol()` — legacy entry; prefer `GET /.well-known/zakai-interop.json`

## Product laws (immutable)

Encoded in every interop document as `laws[]` — see `src/lib/protocol/laws.ts`.

## Related

- `docs/GLOBAL_ACCESS.md` — markets and visitor cookie
- `docs/COUNTRY_PACKS.md` — adding jurisdictions to ZML
- `docs/INFRASTRUCTURE_DOCTRINE.md` — product constraints
