"""
Closed scope registry fragment for institutional verifiers.

FORBIDDEN_SCOPES can never appear on a valid Mandate. The SDK is verify-only:
it never issues tokens and never holds private keys.
"""

from __future__ import annotations

# Keep in lockstep with sdk/src/scopes.ts and src/lib/mandate/scopes.ts
FORBIDDEN_SCOPES: tuple[str, ...] = (
    "payment:initiate",
    "payment:transfer",
    "credit:borrow",
    "account:open",
    "account:close",
    "investment:trade",
)


def contains_forbidden(scopes: list[str] | tuple[str, ...] | set[str]) -> list[str]:
    """Return any forbidden scopes found (empty = clean)."""
    return [s for s in scopes if s in FORBIDDEN_SCOPES]
