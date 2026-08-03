"""
@zakai/mandate — minimal Python SDK (verify + decide + Status List).

Inbound-only Mandate protocol. No private keys. No outbound money scopes.
Same READY_FOR_PIONEER gate as the Node package (`zakai-mandate-ready`).
"""

from .jws import (
    HAS_CRYPTO,
    JwsError,
    clear_jwks_cache,
    fetch_jwks,
    verify_compact_jws,
    verify_status_list_from_url,
    verify_status_list_jwt,
)

__all__ = [
    "HAS_CRYPTO",
    "JwsError",
    "clear_jwks_cache",
    "fetch_jwks",
    "verify_compact_jws",
    "verify_status_list_from_url",
    "verify_status_list_jwt",
]

__version__ = "0.1.0"
