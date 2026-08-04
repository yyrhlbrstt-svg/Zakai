# Intelligence architecture (4 layers)

Zakai’s edge is **context** — packs, outcomes, and user signals — not a bigger foundation model.

## Layer map (code)

| Layer | Role | Shipped today |
|-------|------|----------------|
| **Perception** | What we know without hoarding PII | Client aggregates in `POST /api/intelligence/brief`; OCR stays in browser on `/money`; autopilot watches public sources |
| **Cognition** | Specialist agents | `src/lib/intelligence/agents/*` + Oracle `predict()` |
| **Action** | Mandate-gated execution | Case loop, `negotiation.ts`, vertical agents — user approves send |
| **Reflection** | Improve from outcomes | `StrategyOutcome`, `/api/cron/evolve`, autopilot outcome-learner |

## API

- Manifest: `/.well-known/zakai-intelligence.json`
- Brief: `POST /api/intelligence/brief` with optional:

```json
{
  "market": "IL",
  "signals": {
    "cellularMonthlyAgorot": 12000,
    "provider": "cellcom",
    "monthsOnPlan": 18,
    "ageBand": "25_44",
    "children": 2
  }
}
```

Response: agent notes + cohort win rate (if `MIN_SAMPLE`) + recommended routes (`/check`, `/rights`, `/money`).

## What we do **not** claim yet

- Full personal knowledge graph with user id on server
- Vector DB RAG (ZML catalog + `evaluateRights` / `evaluatePack` is retrieval today)
- Zero-shot jurisdiction transfer (roadmap — packs per market)
- Autonomous send without user approval
- TikTok growth bot posting

## Related

- Oracle: `src/lib/oracle/`
- Assistant: `buildAssistantSystem` + case snapshot
- `docs/AUTOPILOT.md`, `docs/MONOPOLY_FIVE_DOMAINS.md`
