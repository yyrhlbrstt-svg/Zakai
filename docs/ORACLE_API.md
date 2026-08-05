# Oracle API — outcome-graph pricing, sold to institutions

`POST /api/oracle/predict` turns the de-identified `StrategyOutcome` graph into
an answer an underwriter, insurer, or litigation-finance fund can price
against: "will this claim pay, how much, how long" — with a calibration
verdict attached, so the probability is not just served, it is measured.

## 1. Mint a customer key (admin)

```bash
curl -sS -X POST "https://zakai-3uxj.vercel.app/api/oracle/keys" \
  -H "Authorization: Bearer $ZAKAI_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Acme Insurance"}'
```

Response includes `api_key` (`ok_live_…`). It is stored in Postgres
(`OracleKey`) immediately — durable across deploys, unlike an env var. Revoke
one customer by setting that row's `revokedAt`; every other customer's key
keeps working. `ORACLE_API_KEY` still works as a single "master" key for
backward compatibility, but a real multi-customer rollout should mint one key
per customer — a shared secret cannot be sold to more than one paying
institution and cannot be revoked for one without breaking all of them.

## 2. Call it

```bash
curl -sS -X POST "https://zakai-3uxj.vercel.app/api/oracle/predict" \
  -H "Authorization: Bearer ok_live_..." \
  -H "Content-Type: application/json" \
  -d '{"market":"IL","vertical":"telecom","counterparty":"cellcom"}'
```

Rate limit: 600 requests / 60s, keyed by the resolved customer identity (not
IP — one customer's traffic can legitimately share an exit IP with unrelated
callers).

## 3. Read the response honestly

- `confident: false` means do not price money against this answer — too few
  observed outcomes to trust the number. A caller that multiplies an
  unconfident probability by a real amount is the failure mode this field
  exists to prevent.
- `calibration` is a standing, measured claim about how the model has scored
  on claims it had not seen — not a one-time backtest. Anyone can serve a
  probability; what makes one worth paying for is a number that keeps being
  checked against reality.

## Laws

Same non-negotiables as everywhere else in this codebase: never fabricate a
probability, never promise a specific outcome, `StrategyOutcome` stays
de-identified (no User/Case FK reachable from any of this).
