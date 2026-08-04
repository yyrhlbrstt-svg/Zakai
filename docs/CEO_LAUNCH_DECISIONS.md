# CEO launch decisions (Aug 2026)

**Founder override:** Do **not** treat PayPlus, SMTP, branded domain, and public support inbox as the near-term goal. Wire those only after **institutional gravity** — when ignoring the protocol costs more than adopting it. See `docs/INDISPENSABILITY_STRATEGY.md`.

**Ambition:** Pursue **all** monopoly directions in parallel (`docs/MONOPOLY_EXECUTION_ALL.md`) — Mandate gravity plus six published domains — without faking traction.

## Ship order (code)

1. **Merge [PR #71](https://github.com/yyrhlbrstt-svg/Zakai/pull/71)** into `main` (protocol + product skeleton). Close #70 as superseded.
2. Keep production deployable; use **mock payments** and **queued outbox** until phase D in indispensability doc.
3. **`npm run verify:production-urls`** after deploy — JWKS, interop, domains manifest, catalog.

## Commercial env (phase D — deferred)

| Variable | When |
|----------|------|
| `PAYMENT_PROVIDER=payplus` | After mandate/ZML gravity justifies success fees at scale |
| `SMTP_*` | When institution inbound volume needs reliable delivery identity |
| Public domain + support inbox | When «launch» is strategic, not before indispensability |

Until then: no fake «we're live» consumer marketing; build **five monopoly directions** honestly.

## Product law (unchanged)

- No fabricated savings, no demo `StrategyOutcome` rows.
- Banks calling you is an **outcome** of volume + standard — not a press release.

## Docs

- `docs/INDISPENSABILITY_STRATEGY.md` — north star
- `docs/MONOPOLY_FIVE_DOMAINS.md` — five moats map
- `docs/PROTOCOL_SCALE_ASSESSMENT.md` — gates (re-read with indispensability first)
