# zakai-mandate (Python)

Minimal official Python SDK for the **Zakai Mandate** protocol.

- Fetch JWKS
- Verify Ed25519 compact JWS / `statuslist+jwt`
- Run published authorization test vectors
- Exit `READY_FOR_PIONEER` when the same gate as Node passes

**Inbound-only.** No private keys. No outbound money scopes. No invented permits.

## Install (monorepo — works today)

```bash
cd sdk/python
pip install -e '.[crypto]'
zakai-mandate-ready --origin https://zakai-3uxj.vercel.app
```

Or without installing the package:

```bash
cd sdk/python
pip install cryptography
PYTHONPATH=src python -m zakai_mandate --ready
```

Legacy path still works: `reference/python/zakai_verify.py` (shim → same logic).

## What “ready” means

```
authorization vectors: CONFORMANT
status list: VERIFIED
READY_FOR_PIONEER
Next: …/he/institutions/leader
```

Then claim a Pioneer slot in the Reference Verifier wizard.  
Not regulatory certification. Wall stays empty until a real opt-in.

Machine twin: `GET /api/mandate/ready`

## Library use

```python
from zakai_mandate import verify_status_list_from_url

claims = verify_status_list_from_url(
    status_list_uri="https://zakai-3uxj.vercel.app/api/mandate/revocations",
    issuer="https://zakai-3uxj.vercel.app",
    jwks_uri="https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
)
```

HTTP verify for one Mandate (when you want the live API):

```bash
python -m zakai_mandate --jws '<compact>' --audience your-institution-slug
```

## Node twin

```bash
cd sdk && npm ci && npm run ready
# after publish: npx zakai-mandate-ready
```

Same vectors. Same Status List. Same Pioneer gate.
