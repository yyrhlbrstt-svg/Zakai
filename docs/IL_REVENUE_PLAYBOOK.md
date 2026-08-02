# IL revenue playbook (founder)

Zakai wins when every **pain Israelis already pay lawyers/advisors for** has a **door in-app** → letter or full agent → **success fee on documented savings**.

## Live agent loops (highest LTV)

| Door | Fee trigger |
|------|-------------|
| `/money`, `/check` | Telecom / subs negotiation |
| `/cancel` | Subscription cancel / retention |
| `/bank-fees` | Fee waiver |
| `/electricity` | Switch / social tariff |
| `/flights` | Aviation compensation |
| `/deposit` | Rental deposit return |
| `/refund-chase`, `/parking`, `/transport-fine`, `/late-payment` | Written chase |

## New letter-pack doors (this batch)

| Door | Problem | Citation |
|------|---------|----------|
| `/consumer-cancel` | Gym, online course, door-to-door — 14 days | חוק הגנת הצרכן §14ג |
| `/collection-complaint` | Harassing collector | חוק הגנת הצרכן + רשות שוק ההון |
| `/car-insurance-refund` | Mid-term cancel premium | חוק חוזי הביטוח |
| `/toll-dispute` | Highway 6 wrong charge | Cross-Israel Highway appeal |
| `/vehicle-license-refund` | Deregistered car | תקנות תעבורה |
| `/train-delay` | Israel Railways policy | Operator policy (honest) |

## Next verticals to build (backlog)

1. **Vaad bait** — excess building-committee charges (letter + evidence).
2. **Water (Mekorot)** — social rate / leak credit (extend `water_*` rights).
3. **Private health duplicate billing** — already `/duplicate-insurance`; push agent loop.
4. **Loan commission clawback** — illegal bank fees variant.
5. **Warranty / retailer refusal** — extend `/warranty` to agent send.
6. **Arnona** — `/arnona` exists; add agent follow-up tier.

Machine map: `GET /api/network/opportunity-map?market=IL`

Honesty: no invented recovery amounts in UI; `revenueVerticals.ts` uses indicative minors only.
