# Zakai Pipe — Mandate → SavingsProof rails

**Machine entry:** `GET /.well-known/zakai-pipe.json` · `GET /api/pipe`  
**Human entry:** `/he/pipe`  
**Acceptor mark:** `GET /api/pipe/mark`  
**Interop profile:** `zakai-pipe-1` in `/.well-known/zakai-interop.json`

## Visa / Google bar (what “done” means)

| Analogy | Zakai equivalent | Status |
|---------|------------------|--------|
| Visa format every merchant speaks | Mandate JWS + `/api/pipe/accept` | Built — needs volume |
| Visa settlement / chargeback trail | SavingsProof + settlement drafts | Built — needs proofs |
| Visa acceptance mark | `/api/pipe/mark` | Built |
| Google default starting place | `/money` + assistant → one next action | Built — needs habit |
| Network effect scoreboard | `/api/pipe` → `network.gravity_tier` | Built — empty until SENT |

We are **not** Google/Visa until `gravity_tier` reaches `network` with real SMTP delivery. Until then: ship volume on these rails — do not invent partners.

## What the pipe is

Not another consumer screen. Four rails every bank, telecom, utility, and foreign AI must eventually speak:

1. **Authority** — Ed25519 Mandate (JWKS, verify, decide, revoke). Institution one-shot: `POST /api/pipe/accept`.
2. **Intake** — inbound-only receive (`/api/institution/inbound-receive` + `reference/inbound-receiver/`). No callback to Zakai.
3. **Outcomes** — de-identified `GET /api/network/savings-ledger` + `/he/proofs`. Empty is honest.
4. **Agents** — `POST /api/pipe/handoff` returns an attributed consumer URL. LLM proposes; user executes.

## Hard laws

- No outbound money Mandate scopes.
- Fee only after SavingsProof.
- Never invent amounts.
- When Mandate signing keys are live, every SENT case must carry a machine Mandate JWS.

## Integrator minutes

**Institution**

```bash
curl -sS -X POST "$ORIGIN/api/pipe/accept" \
  -H 'content-type: application/json' \
  -d '{"mandate_jws":"<JWS>","action":"correspond:provider"}'
```

**Foreign agent**

```bash
curl -sS -X POST "$ORIGIN/api/pipe/handoff" \
  -H 'content-type: application/json' \
  -d '{"agent":"my-ai","door":"cancel","locale":"he"}'
```

See also: `docs/INFRASTRUCTURE_DOCTRINE.md`, `docs/ZML_SDK_INTEGRATION.md`, `sdk/README.md`.
