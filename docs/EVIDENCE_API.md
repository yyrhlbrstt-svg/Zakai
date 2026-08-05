# Evidence API — licensed systemic-pattern reports, sold to plaintiff firms & regulators

`POST /api/evidence/systemic-pattern` turns the same de-identified
`StrategyOutcome` graph the Oracle API reads (see `docs/ORACLE_API.md`) into
a different product for a different buyer: not "will this claim pay" but
"what did documented settlements against this named provider actually look
like" — the aggregate a plaintiff firm needs to decide whether a systemic
pattern is worth investigating, or a regulator wants as a standing input to
its own case file.

## 1. Mint a customer key (admin)

```bash
curl -sS -X POST "https://zakai-3uxj.vercel.app/api/evidence/keys" \
  -H "Authorization: Bearer $ZAKAI_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Plaintiff Firm LLP"}'
```

Response includes `api_key` (`ev_live_…`), stored in Postgres (`EvidenceKey`)
immediately. Revoke one customer's row without touching any other customer's
key. `EVIDENCE_API_KEY` still works as a single "master" key for a pilot of
one; a real multi-customer rollout should mint one key per customer.

## 2. Call it

```bash
curl -sS -X POST "https://zakai-3uxj.vercel.app/api/evidence/systemic-pattern" \
  -H "Authorization: Bearer ev_live_..." \
  -H "Content-Type: application/json" \
  -d '{"market":"IL","provider":"cellcom"}'
```

Rate limit: 120 requests / 60s, keyed by the resolved customer identity.

## 3. What it actually says, and what it refuses to say

- Below the same `MIN_SAMPLE` gate every provider-facing aggregate in this
  codebase uses (`src/lib/companyScore.ts`), the response is
  `available: false, reason: "insufficient_sample"` — never a fabricated or
  thin-sample number. A count of one or two documented cases identifies real
  people; the gate exists for exactly the reason `MIN_SAMPLE` exists
  everywhere else.
- Above the gate, the response is neutral counts only — documented cases,
  paid rate, total/average recovered amount, median days to resolution, the
  date range the sample covers — with a `legal_note` stated in the response
  itself: *"This is a neutral, aggregated count of documented settlement
  outcomes. It states no legal conclusion, alleges no wrongdoing, and is not
  a substitute for the underlying discovery a real filing requires."*
- Only verified, non-self-reported `StrategyOutcome` rows are counted — the
  same filter `loadFairnessScores` uses for institutional-grade data.
- De-identified by construction: `StrategyOutcome` carries no User/Case FK,
  so there is nothing in the underlying table to link a row to a person even
  with database access.

## Second report: institution risk trend

`POST /api/evidence/institution-risk-trend` — same `EvidenceKey`/
`EVIDENCE_API_KEY` auth, same rate limiting, different question. The free
public `GET /api/institution/inbound-pressure` publishes one current
snapshot of documented outbound case volume per institution; this splits
that same volume into two consecutive 30-day windows so a regulator's own
risk team or an institution's own compliance desk sees *direction* —
whether pressure is accelerating — not just today's level.

```bash
curl -sS -X POST "https://zakai-3uxj.vercel.app/api/evidence/institution-risk-trend" \
  -H "Authorization: Bearer ev_live_..."
```

Same discipline as the systemic-pattern report: gated by `MIN_SAMPLE` total
across both windows, and `change_pct` is `null` — never a fabricated ratio —
when the prior window had zero cases. Deliberately a two-window delta, not a
fitted trendline: claiming more statistical sophistication than a sample
supports is the same honesty failure `MIN_SAMPLE` and the Oracle's
`confident` flag both exist to prevent.

## Laws

Same non-negotiables as everywhere else in this codebase: never fabricate a
number, never state a conclusion the data doesn't support, `StrategyOutcome`
stays de-identified.
