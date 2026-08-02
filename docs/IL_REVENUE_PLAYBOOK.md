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
| `/vaad-bait` | HOA charge transparency | חוק המקרקעין — ועדי בתים |
| `/water-bill` | Concealed leak credit | כללי תאגידי מים |
| `/landlord-repairs` | Rental essential repairs | חוק השכירות והשאילה |
| `/duplicate-charge` | Duplicate/wrong charge | עשיית עושר ולא במשפט |
| `/telecom-exit` | Disconnect + refunds | חוק התקשורת |
| `/warranty` | Product warranty letter | חוק הגנת הצרכן |

## Next verticals to build (backlog)

1. **Private health duplicate billing** — `/duplicate-insurance` — full agent loop (Mandate + send).
2. **Loan commission clawback** — `/bank-loan-fee` letter pack; agent path `/bank-fees`.
3. **Arnona** — `/arnona` full agent loop (Mandate + send + monthly fee on documented bill drop).

Machine map: `GET /api/network/opportunity-map?market=IL`

Honesty: no invented recovery amounts in UI; `revenueVerticals.ts` uses indicative minors only.
