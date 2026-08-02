# Zakai packs CDN (S3 + CloudFront)

The `zakai-packs` directory in this monorepo is the source tree to push to **`github.com/zakai/zakai-packs`** (or publish from here until the org repo exists).

## S3 bucket (public read)

```bash
aws s3api create-bucket \
  --bucket packs.zakai.io \
  --region eu-central-1 \
  --create-bucket-configuration LocationConstraint=eu-central-1

aws s3api put-public-access-block \
  --bucket packs.zakai.io \
  --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

aws s3api put-bucket-policy \
  --bucket packs.zakai.io \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::packs.zakai.io/*"
    }]
  }'
```

## CloudFront

- Origin: `packs.zakai.io.s3.eu-central-1.amazonaws.com`
- Default TTL: 300s
- Alternate domain: `packs.zakai.io` (ACM certificate required)

## GitHub Actions OIDC

Create an IAM role trusted by GitHub OIDC for this repository, grant `s3:PutObject` on the bucket and `cloudfront:CreateInvalidation`.

Secrets in `zakai-packs` repo:

| Secret | Purpose |
|--------|---------|
| `AWS_ROLE_ARN` | OIDC role |
| `ZAKAI_PACKS_BUCKET` | `packs.zakai.io` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Invalidation |
| `ZAKAI_ADMIN_TOKEN` | Notify engine reload |
| `ZAKAI_ENGINE_URL` | e.g. `https://zakai-3uxj.vercel.app` |

## Zakai main app env

```bash
ZML_PACKS_CDN=https://packs.zakai.io
ZML_PACKS_LOCAL=/absolute/path/to/zakai-packs   # dev only
ZML_ENGINE_VERSION=1.0.0
ZAKAI_ADMIN_TOKEN=...
```

After publish, CI calls `POST /api/admin/packs/reload` to bust in-memory caches.
