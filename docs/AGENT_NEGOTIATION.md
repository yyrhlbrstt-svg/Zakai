# Zakai agent — closed-loop negotiation (solo / AI-only)

## Goal
Close cases without a human call center. User + product + model only.

## Loop
1. Analyze bill → strategy + first Hebrew outreach (disclosure: digital agent)
2. User approves → ownership → authorization → mark SENT
3. Provider replies → user picks reply kind → `/api/cases/:id/follow-up` drafts next message
4. User copies & sends
5. User records new monthly amount → savings proof → success fee → share on WhatsApp

## Reply kinds
- refused / too_low / delay / asked_call / accepted / other

## Rules the agent must never break
- No promised outcomes
- No impersonating the customer
- No outbound money movement
- Prefer written offers over phone-only deals
- Fee only after documented saving

## Product surfaces
- Dashboard `CaseNextStep` (full path)
- `src/lib/negotiation.ts` (deterministic playbooks)
- Assistant (`askZakai`) points users to `/check`, `/money`, `/dashboard`
