# Gravity runbook — from protocol skeleton to hard-to-ignore

Code cannot fake banks or governments. This is the founder sequence after the
Visa rails land on production. Meter: `GET /api/network/trillion-gates`.

## 0) Deploy Phase A

1. Merge the rails PR; confirm Vercel builds the **new** commit (not Ready Stale).
2. `npx prisma migrate deploy` (includes `mandateJws`, `WidgetKey`, …).
3. `npm run gravity:checklist` against production.
4. Smoke: `/he/join-network`, `/api/cdn/packs/manifest.json`, `/api/institution/inbound-receive`, `/api/mandate/delegation/evidence`.

## 1) Packs as default data (G2 external)

```bash
npm run packs:release-check
npm run packs:export
# push the export tree to github.com/…/zakai-packs
# set ZML_PACKS_CDN=https://packs.zakai.io on Vercel
```

Origin mirror `/api/cdn/packs` already serves the monorepo artifact for evaluation.

## 1b) Founder cockpit

- `/he/founder` shows live ControlGatesStrip + CEO action list (after ADMIN_EMAIL login).
- Outreach one-pager: `/api/institution/outreach-kit` (mailto template, no fake logos).

## 2) First Reference Verifier (G3) — pull, not cold email

**Do not** blast banks. Make them email you:

1. Consumer SENT volume with footers → desk pain.
2. `/institutions` mailto + ROI → they initiate.
3. Empty Pioneer wall + consumer «ask your bank».
4. When they write: reply with `pilot-package?audience=…`.

See `/api/institution/outreach-kit` (pull kit) and `docs/INSTITUTIONAL_PULL.md`.

### G3 steps once they inquire


1. Use `/api/institution/outreach-kit` mailto → send to risk/ops.
2. They open `/he/join-network` → wizard; download `/api/institution/pilot-package?audience=<their-aud>` (filled sample curl when keys live).
3. Clone `/reference/inbound-receiver/receive.mjs` into their VPC.
3. They opt into `/he/institutions/leaders` via the public register API.
4. Leaders wall stays empty until that row exists — no fake logos.
5. After merge: confirm `/api/cdn/packs/il/index.json` is 200 (NFT include in next.config).

## 3) Second issuer (G5) — human after dry-run

1. Candidate: `POST /api/mandate/delegation/evidence` with their issuer JSON.
2. Or delegated: `POST /api/mandate/delegation/apply`.
3. Founder admits: `POST /api/mandate/delegation/issuers` (delegated) or
   `POST /api/mandate/registry/issuers` (full JWKS issuer) — both admin
   token, after review.

## 4) Volume (G4 / G6 / G7 / G8)

- Close real case loops (SENT → SAVED) so fairness + inbound-pressure light up.
- Agent handoffs: `/he/must-have?utm_source=agent&utm_campaign=agent-<name>`.
- Partner embeds: durable `WidgetKey` via admin register + `/he/fairness-certified`.

## 5) Phase D commercial (G9) — only after gravity

PayPlus, SMTP, branded domain, success-fee close. Connecting them earlier does
not create monopoly; it only operates SaaS on empty rails.

## Quick links

| Surface | URL |
|---------|-----|
| Join kit JSON | `/api/network/join-kit` |
| Join page | `/he/join-network` |
| Gates | `/api/network/trillion-gates` |
| Indispensability | `/api/network/indispensability` |
| Regulatory brief | `/api/regulatory/snapshot?market=IL&format=brief` |
| Markdown brief | `/api/regulatory/snapshot?market=IL&format=md` |

See also: `docs/INDISPENSABILITY_STRATEGY.md`, `docs/GLOBAL_MONOPOLY_PLAYBOOK.md`.
