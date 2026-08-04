# zakai-mandate (Python)

Official **Python** Mandate verifier — twin of [`@zakai-app/mandate-sdk`](../README.md).

**Start here → [`../QUICKSTART.md`](../QUICKSTART.md)** · Safety → [`../SAFETY.md`](../SAFETY.md)

```bash
cd sdk/python
pip install -e '.[crypto]'
zakai-mandate-ready --origin https://zakai-3uxj.vercel.app
# → READY_FOR_PIONEER → /he/institutions/leader
```

## Guarantees

- **Verify-only** — no private keys, cannot issue Mandates
- **Inbound-only** — rejects `FORBIDDEN_SCOPES` (payment/transfer/borrow/…)
- **Same Pioneer gate as Node** — vectors + cryptographically verified Status List

## Library

```python
from zakai_mandate import (
    FORBIDDEN_SCOPES,
    verify_mandate_from_url,
    verify_status_list_from_url,
)

claims = verify_mandate_from_url(
    jws,
    audience="your-institution-slug",
    jwks_uri="https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
)

verify_status_list_from_url(
    status_list_uri="https://zakai-3uxj.vercel.app/api/mandate/revocations",
    issuer="https://zakai-3uxj.vercel.app",
    jwks_uri="https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
)
```

HTTP verify (optional):

```bash
python -m zakai_mandate --jws '<compact>' --audience your-institution-slug
```

## Without packaging

```bash
pip install cryptography
PYTHONPATH=src python -m zakai_mandate --ready
# or: python examples/ready.py
```

Legacy shim: `reference/python/zakai_verify.py` → same package.
