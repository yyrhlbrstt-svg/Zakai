# Rights-check widget embed (ZML catalog)

Partner sites load `zakai-widget.js` to show a **rights orientation** strip. No PII leaves the partner page until the user clicks through to Zakai. This is not the fairness-score program (`docs/FAIRNESS_CERTIFIED_PROGRAM.md`) — it surfaces one relevant entitlement from the public rights catalog, not a per-company score.

## 1. Register a domain (admin)

```bash
curl -sS -X POST "https://zakai-3uxj.vercel.app/api/widget/register" \
  -H "Authorization: Bearer $ZAKAI_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain":"yourbank.co.il"}'
```

Response includes `api_key`. **Persist it** in Vercel env:

```bash
ZAKAI_WIDGET_KEYS_JSON='{"pk_live_...":{"domain":"yourbank.co.il","created":"2026-08-02T00:00:00.000Z"}}'
```

Keys are persisted in Postgres (`WidgetKey` table) as soon as they're registered — `ZAKAI_WIDGET_KEYS_JSON` remains a bootstrap/override layer, not the only copy.

## 2. Snippet

```html
<link rel="stylesheet" href="https://zakai-3uxj.vercel.app/widget/zakai-widget.css" />
<div
  id="zakai-rights-check"
  data-api-key="pk_live_YOUR_KEY"
  data-provider="Cellcom"
  data-market="IL"
></div>
<script
  src="https://zakai-3uxj.vercel.app/widget/zakai-widget.js"
  data-api-base="https://zakai-3uxj.vercel.app/api"
  async
></script>
```

The script auto-mounts on `[data-api-key]`, `[data-zakai-widget]`, or `[data-zakai-check]`.

### White-label (optional)

| Attribute | Purpose |
|-----------|---------|
| `data-brand-name` | Badge text instead of "Zakai Rights Check" |
| `data-hide-badge="true"` | Hide badge entirely |
| `data-accent="#005EB8"` | Bank brand color (CSS variable) |
| `data-cta-url` | Override CTA link |

Brief-style check attribute:

```html
<div data-api-key="pk_live_..." data-zakai-check="provider:cellcom,amount:120"></div>
```

## 3. Validate key (browser / partner CI)

```bash
curl -sS "https://zakai-3uxj.vercel.app/api/widget/validate" \
  -H "Origin: https://app.yourbank.co.il" \
  -H "X-Zakai-Widget-Key: pk_live_..."
```

- `200` + `{ "valid": true }` — origin hostname matches registered domain (subdomains allowed).
- `403` — wrong or missing key.

CORS: successful validation echoes `Access-Control-Allow-Origin` for the request `Origin`.

## 4. Catalog API (widget runtime)

`GET /api/rights/catalog?market=IL&category=telecom` with headers:

- `X-Zakai-Widget-Key`
- `X-Zakai-Widget-Version: 1.0.0`

When the widget key header is present, the key must be valid for the `Origin` host.

## 5. Money OS iframe embed (separate product)

Full agent flows use `embed.js` + `#zakai-embed` — see `/he/partners` and `docs/SCALE_DISTRIBUTION.md`.

## Laws

Widget copy must not promise outcomes. Protocol laws: `/.well-known/zakai-protocol.json`.

Program spec: `docs/FAIRNESS_CERTIFIED_PROGRAM.md`. Mandate verification for agents: MCP server, not yet on the public npm registry — see `sdk/README.md` ("MCP server" section) for the zero-setup install.
