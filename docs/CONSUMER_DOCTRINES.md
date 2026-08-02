# Consumer doctrines (product ↔ legal alignment)

Internal map from strategy language to what we ship and what terms say.

## Word — your letter

- LLM and playbooks **propose** text; the app **does not** send the first provider message without an explicit user action in the case flow (`human_gate_execute`).
- Templates are self-help; the user sends in their own name.

## Post Office — messenger, not lawyer

- Outbound consumer email is **courier** delivery with a verifiable Mandate (JWKS, revocation).
- No legal representation, no outbound money scopes on Mandates.

## Waze — navigation, not arrival

- Rights catalog, calculators, and ZML are orientation with real citations — not a promise of eligibility or amount.
- Terms and UI disclaimers match: outcome depends on provider/authority.

## Follow-up rounds (honest automation)

- Rounds 2–4 may run via cron while Mandate is `ACTIVE`, ownership verified, and caps apply (`MAX_AGENT_ROUNDS` in `agentFollowUp.ts`).
- Terms and `CaseNextStep` copy must not imply instant auto-send on round 2 without the delay/cap/mandate conditions.

## Proof and marketing

- Success fee only after documented `SavingsProof` (integer minor units).
- No fake testimonials, user counts, or aggregate savings in UI (`provenSavings`, proofs wall only).

## Machine-readable laws

- `PROTOCOL_LAWS` in `src/lib/protocol/laws.ts` → `/.well-known/zakai-protocol.json` and `/protocol` page.
