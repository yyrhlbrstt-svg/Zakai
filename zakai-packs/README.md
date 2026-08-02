# zakai-packs

Community-maintained **ZML** jurisdiction packs for the [Zakai](https://github.com/yyrhlbrstt-svg/Zakai) rights protocol.

## Layout

- `schema/zakai-rights-schema.json` — canonical JSON Schema (must match main repo `/.well-known/zakai-rights-schema.json`)
- `packs/{market}/index.json` — pack manifest
- `packs/{market}/rights/*.json` — one ZML document per right
- `maintainers/` — registry of approved maintainers

## Commands

```bash
npm ci
npm run validate
```

Publish (CI only, requires AWS OIDC):

```bash
ZAKAI_PACKS_BUCKET=packs.zakai.io npm run publish
```

## Adding a market

1. Copy `packs/_template/` to `packs/xx/`
2. Add maintainer to `maintainers/_registry.json`
3. Open PR — CI validates every right against the schema

## CDN

Published artifacts are served from `https://packs.zakai.io/{market}/index.json` (S3 + CloudFront). The Zakai engine loads packs when `ZML_PACKS_CDN` is set.

See `docs/INFRA_ZAKAI_PACKS.md` in the main Zakai repository for AWS setup.
