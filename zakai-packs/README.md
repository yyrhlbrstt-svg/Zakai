# @zakai/packs

Signed ZML rights packs for the Zakai engine. This directory is the **source of truth** to mirror into `github.com/zakai/zakai-packs` (standalone repo) for CI publish to S3/CloudFront.

## Quick start

```bash
npm ci
npm run validate
```

## Layout

| Path | Role |
|------|------|
| `schema/zakai-rights-schema.json` | JSON Schema for each right document |
| `packs/il/rights/*.json` | Israel catalog (76 rights) |
| `packs/eu/` | EU samples (e.g. flight delay 261) |
| `maintainers/_registry.json` | Maintainer registry for sign-check |

## Publish (CI)

On push to `main`, GitHub Actions runs `validate`, then (with OIDC secrets) `npm run publish` to S3 and invalidates CloudFront. See `docs/INFRA_ZAKAI_PACKS.md` in the main Zakai repo.

Required secrets in the **zakai-packs** repository:

- `AWS_ROLE_ARN`, `ZAKAI_PACKS_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`
- Optional: `ZAKAI_ADMIN_TOKEN`, `ZAKAI_ENGINE_URL` (engine cache reload)

## Local dry-run

```bash
npm run publish
# without ZAKAI_PACKS_BUCKET — lists files only
```

## Export to standalone GitHub repo

From the monorepo root:

```bash
npm run packs:export
# or: ./scripts/export-zakai-packs-repo.sh
```

Follow the printed `git push` instructions. Do not commit `node_modules/`.

See `docs/ZML_SDK_INTEGRATION.md` and `docs/INFRA_ZAKAI_PACKS.md` in the main repo.

## Engine discovery

Live manifest: `/.well-known/zakai-packs.json` on the Zakai deployment (CDN base in `cdn_base`).

## Engine consumption

Main app env:

```bash
ZML_PACKS_CDN=https://packs.zakai.io
ZML_PACKS_LOCAL=/absolute/path/to/zakai-packs   # dev
```

After CDN publish: `POST /api/admin/packs/reload` with `ZAKAI_ADMIN_TOKEN`.
