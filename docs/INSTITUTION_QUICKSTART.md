# Institution quickstart — Mandate in 20–30 minutes

**Canonical doc (keep this file as a pointer):** [`sdk/QUICKSTART.md`](../sdk/QUICKSTART.md)

Safety contract: [`sdk/SAFETY.md`](../sdk/SAFETY.md)

Human UI: `/he/institutions/quickstart` · Pioneer wizard: `/he/institutions/leader`

## One path

1. Run official SDK gate (Node **or** Python) → `READY_FOR_PIONEER`
2. Confirm `GET /api/mandate/ready` → `ready_for_pioneer: true`
3. Reference Verifier wizard → opt into Pioneer wall (max 3)

Not regulatory certification. No sales call. Inbound-only protocol — SDKs cannot move money.

```bash
# Node
cd sdk && npm ci && npm run ready

# Python
cd sdk/python && pip install -e '.[crypto]' && zakai-mandate-ready
```
