# Zakai agent — closed-loop negotiation (solo / AI-only)

## Goal
Close cases without a human call center. User + product + model only.

## Loop
1. Analyze bill → strategy + first Hebrew outreach (disclosure: digital agent)
2. User reviews/edits draft → ownership → authorization → dispatch SENT (Mandate attached)
3. Provider replies → user picks reply kind → `/api/cases/:id/follow-up` drafts next message
4. User confirms → `send: true` dispatches via Zakai Outbox + Mandate (HITL). Copy remains as fallback.
5. User records new amount / remaining owed → savings proof → success fee → share

Auto delay reminders (`agentFollowUp`) still run while Mandate is active (capped rounds).

## Reply kinds
- refused / too_low / delay / asked_call / accepted / competitor / other

## Vertical playbooks
- Telecom / electricity retention → `negotiation.ts` (monthly)
- Airline → `flightNegotiation.ts`
- Lump recoveries (fees, cancel, deposit, refunds, …) → `lumpNegotiation.ts`
- Router: `followUpRouter.ts` → `buildFollowUpForVertical`

## Rules the agent must never break
- No promised outcomes
- No impersonating the customer
- No outbound money movement
- Prefer written offers over phone-only deals
- Fee only after documented saving

## Product surfaces
- Dashboard `CaseNextStep` (full path + Send via Zakai)
- OvernightAgent (batch draft → per-case send)
- `src/lib/negotiation.ts` + vertical routers
- Assistant (`askZakai`) points users to `/check`, `/money`, `/dashboard`
