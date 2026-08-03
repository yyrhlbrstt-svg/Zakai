"""
Minimal Mandate verify (Ed25519 compact JWS) — verify-only, no issue path.
"""

from __future__ import annotations

import time
from typing import Any

from .jws import JwsError, fetch_jwks, verify_compact_jws
from .scopes import contains_forbidden


def _audience_ok(aud: Any, expected: str) -> bool:
    if isinstance(aud, list):
        return expected in {str(a) for a in aud}
    return str(aud or "") == expected


def _scopes_from_claims(claims: dict[str, Any]) -> list[str]:
    if isinstance(claims.get("scope"), str):
        return [s for s in claims["scope"].split(" ") if s]
    raw = claims.get("scopes") or []
    if isinstance(raw, list):
        return [str(s) for s in raw]
    return []


def verify_mandate(
    token: str,
    *,
    audience: str,
    jwks: list[dict[str, Any]],
    now: float | None = None,
    tolerance_sec: int = 60,
) -> dict[str, Any]:
    """Verify signature + audience + expiry. Rejects forbidden money scopes."""
    if not audience.strip():
        raise JwsError("audience is required")
    _header, claims = verify_compact_jws(token, jwks)
    if not _audience_ok(claims.get("aud"), audience.strip()):
        raise JwsError("audience mismatch")
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)):
        raise JwsError("mandate missing exp")
    now = time.time() if now is None else now
    if now - tolerance_sec >= exp:
        raise JwsError("mandate expired")
    nbf = claims.get("nbf")
    if isinstance(nbf, (int, float)) and now + tolerance_sec < nbf:
        raise JwsError("mandate not yet valid")
    scopes = _scopes_from_claims(claims)
    bad = contains_forbidden(scopes)
    if bad:
        raise JwsError(f"forbidden scopes present: {', '.join(bad)}")
    return claims


def verify_mandate_from_url(
    token: str,
    *,
    audience: str,
    jwks_uri: str,
    now: float | None = None,
    tolerance_sec: int = 60,
) -> dict[str, Any]:
    """Fetch JWKS and verify — the three-line institutional path."""
    jwks = fetch_jwks(jwks_uri)
    return verify_mandate(
        token,
        audience=audience,
        jwks=jwks,
        now=now,
        tolerance_sec=tolerance_sec,
    )
