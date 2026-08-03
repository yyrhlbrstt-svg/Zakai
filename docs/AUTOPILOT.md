# Zakai Autopilot — self-updating system

Zakai cannot auto-merge law, auto-post spam, or move money. Autopilot **detects**, **logs**, and **opens maintainer tasks** — humans stay on the gate for ZML and legal text.

## Five engines

| Job | Cron (Vercel) | What it does |
|-----|----------------|--------------|
| `law-watcher` | `0 */6 * * *` → `/api/cron/autopilot/law-watcher` | Hash HTTP `source` URLs in packs; GitHub issue on change |
| `price-sentinel` | via daily `/api/cron/autopilot` | `AUTOPILOT_PRICE_FEEDS_JSON` public pages |
| `outcome-learner` | weekly (interval) | `StrategyOutcome` variant stats; evolve runs separately |
| `growth-bot` | daily | Topic digest from outcomes; **no TikTok post** without API keys |
| `market-expander` | weekly | Collective intent → maintainer issues |

Coordinator: `GET /api/cron/autopilot` runs **due** jobs by `AutopilotRun` timestamps.

## Discovery

- `/.well-known/zakai-autopilot.json`
- `GET /api/autopilot/status` (includes last run per job)

## Env

```bash
CRON_SECRET=                    # required in production (existing)
GITHUB_TOKEN=                   # optional: open issues on zakai-packs
AUTOPILOT_GITHUB_REPO=org/zakai-packs
AUTOPILOT_PRICE_FEEDS_JSON=[{"provider":"iec","url":"https://...","market":"IL"}]
TIKTOK_ACCESS_TOKEN=            # optional; growth-bot stays digest-only without it
```

## Related

- `/api/cron/evolve` — template A/B promotion (daily)
- `/api/cron/vigil` — user deadline alerts (daily)
- `docs/MONOPOLY_FIVE_DOMAINS.md`

## Honesty

- No fabricated legal updates — only hash diffs on fetched URLs.
- No auto-deploy of packs to production CDN.
- Growth bot does not reply on social networks from this repo until explicitly wired.
