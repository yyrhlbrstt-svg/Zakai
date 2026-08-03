# Fairness Certified program (spec only)

**Status:** Specification — not a legal certification mark. Requires counsel before any public «certified» badge.

## Purpose

Give partners a **honest** embed path: public fairness metrics only when `MIN_SAMPLE` de-identified outcomes exist for a provider. Until then, the widget shows an empty state — never fabricated scores.

## Eligibility (technical)

1. **Widget key** issued after domain allowlist validation (`GET /api/widget/validate`).
2. **Provider mapping** — `data-provider` must match a known provider key in Zakai (or generic label with no score until mapped).
3. **Market** — `data-market` ISO code with an active fairness API slice.

## What we publish

- Machine discovery: `/.well-known/zakai-fairness-certified.json` (`status: spec_only`, empty `certified_providers` until legal + real scores).
- `GET /api/fairness/scores?market=IL` — aggregate fairness index per provider when n ≥ `MIN_SAMPLE`.
- `/he/companies` — same gate for human-readable tables.

## What we do not publish

- User reviews, star ratings, or LLM «opinions».
- Scores for providers below the sample threshold.
- PII or case identifiers.

## Partner obligations (draft)

- Do not imply Zakai guarantees outcomes.
- Link to Zakai for the consumer action path (no callback forms).
- Keep the embed script unmodified except documented `data-*` attributes.

## Roadmap (founder / legal)

- [ ] Trademark / «Fairness Certified» wording review
- [ ] SLA for key rotation and abuse reports
- [ ] Optional co-marketing only after first real MIN_SAMPLE provider

See also: `docs/WIDGET_EMBED.md`, `src/lib/companyScore.ts`.
