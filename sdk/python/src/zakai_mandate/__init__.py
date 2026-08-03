"""
zakai-mandate — minimal Python SDK (verify + decide + Status List).

Inbound-only Mandate protocol:
- No private keys
- No mandate issuance
- Forbidden outbound-money scopes rejected on verify
- Same READY_FOR_PIONEER gate as Node (`zakai-mandate-ready`)
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
from .mandate import verify_mandate, verify_mandate_from_url
from .scopes import FORBIDDEN_SCOPES, contains_forbidden

__all__ = [
    "FORBIDDEN_SCOPES",
    "HAS_CRYPTO",
    "JwsError",
    "clear_jwks_cache",
    "contains_forbidden",
    "fetch_jwks",
    "verify_compact_jws",
    "verify_mandate",
    "verify_mandate_from_url",
    "verify_status_list_from_url",
    "verify_status_list_jwt",
]

__version__ = "0.1.0"
