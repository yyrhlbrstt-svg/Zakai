# Security — public surface vs ops diagnostics

Zakai is **protocol-first**: most discovery is intentionally public (JWKS, OpenAPI, interop probes, opportunity map). That is not a bug — institutions must integrate without a sales call.

Some endpoints were too chatty for anonymous reconnaissance. Policy:

| Endpoint | Public | Internal (founder) |
|----------|--------|---------------------|
| `GET /api/health` | `{ ok, time }` only — DB liveness, 503 if down | `?internal=1` + header `X-Zakai-Admin-Token` — AI provider, mandate keys, markets, endpoint map, optional `checkai=1` |
| `GET /api/version` | `version`, `buildMarker`, `see` links to well-known | Same query + header — operations booleans, AI provider, full market list, feature flags |
| `GET /api/network/readiness` | Booleans only (by design for partners) | — |
| `POST /api/oracle/predict` | Closed unless `ORACLE_API_KEY` set; Bearer required | — |
| Cron routes | `CRON_SECRET` / Vercel cron auth | — |
| `GET /api/release-gate` | Scores + failing check **ids** only | `?internal=1` + admin token — includes `envKeys` per check |
| `GET /api/network/readiness` | Layer booleans, `paymentsMode: live\|demo` | — |

## Configure internal probes

```bash
# Vercel env
ZAKAI_ADMIN_TOKEN=<long random>

curl -sS "https://zakai-3uxj.vercel.app/api/health?internal=1" \
  -H "X-Zakai-Admin-Token: $ZAKAI_ADMIN_TOKEN"

curl -sS "https://zakai-3uxj.vercel.app/api/version?internal=1" \
  -H "X-Zakai-Admin-Token: $ZAKAI_ADMIN_TOKEN"
```

## What attackers still learn (acceptable)

- Well-known JSON files list the same endpoints health used to duplicate.
- `/api/markets` and opportunity map expose market codes — product surface, not secrets.
- AI provider name is no longer on anonymous health/version; inferring “AI works” from product behavior may still be possible.

## Report issues

Security-sensitive findings: founder via `ADMIN_EMAIL` / private channel — do not open public issues with exploit detail.
