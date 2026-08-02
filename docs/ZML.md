# ZML — Zakai Rights Markup Language v1.0

ZML turns jurisdiction packs into a **public contract**: rights as declarative JSON, not app internals.

## Discovery

| Resource | URL |
|----------|-----|
| Protocol manifest (includes ZML links) | `/.well-known/zakai-protocol.json` |
| JSON Schema | `/.well-known/zakai-rights-schema.json` |
| Catalog API | `GET /api/rights/catalog?market=IL` |
| Single right | `GET /api/rights/catalog/{id}?full=1` |

## Versioning

- **ZML spec**: semver `1.0.0` today; breaking changes bump major.
- **Engine**: `ENGINE_ZML_VERSION` in `src/lib/protocol/zml/constants.ts` — same major as pack `zml_version`.
- **Per-right revision**: `version` + `metadata.last_verified` from pack `reviewed` date; no deletes — sunset via `metadata.sunset_date` (future).

## Migration from `RightDef`

All built-in packs use the internal **declarative** `Predicate` language (L0). `rightDefToZml()` in `legacy-adapter.ts` maps predicates and actions to ZML.

Export on disk:

```bash
npx tsx scripts/migrate-legacy-to-zml.ts IL
```

Output: `data/zml-export/il/` (gitignored export for `zakai-packs` repo seed).

## Maintainer flow (target)

External packs live in a separate `zakai-packs` repository, validated in CI, published to CDN (`ZML_PACKS_CDN`). The engine loads built-in `MARKETS` today; `src/lib/protocol/packs/loader.ts` will prefer CDN when conversion is complete.

## Product laws

ZML documents must respect `PROTOCOL_LAWS`: `requires_human_gate` defaults true; `auto_eligible` false for outbound actions; money in minor units; every `source.reference` is a real citation.
