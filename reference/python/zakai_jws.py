#!/usr/bin/env python3
"""
Minimal Zakai Mandate / Status List JWS helpers (Ed25519).

Requires: pip install cryptography
Used by zakai_verify.py --ready for the same crypto bar as the Node SDK.
"""

from __future__ import annotations

import base64
import json
import time
import urllib.request
from typing import Any

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.exceptions import InvalidSignature

    HAS_CRYPTO = True
except ImportError:  # pragma: no cover
    HAS_CRYPTO = False
    Ed25519PublicKey = Any  # type: ignore[misc,assignment]
    InvalidSignature = Exception  # type: ignore[misc,assignment]


class JwsError(Exception):
    pass


_jwks_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_JWKS_TTL_SEC = 300.0


def b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def fetch_jwks(jwks_uri: str, *, now: float | None = None) -> list[dict[str, Any]]:
    now = time.time() if now is None else now
    hit = _jwks_cache.get(jwks_uri)
    if hit and hit[0] > now:
        return hit[1]
    with urllib.request.urlopen(jwks_uri, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    keys = body.get("keys") or []
    if not isinstance(keys, list) or not keys:
        raise JwsError("jwks has no keys")
    _jwks_cache[jwks_uri] = (now + _JWKS_TTL_SEC, keys)
    return keys


def clear_jwks_cache() -> None:
    _jwks_cache.clear()


def _public_key_from_okp(jwk: dict[str, Any]) -> Ed25519PublicKey:
    if jwk.get("kty") != "OKP" or jwk.get("crv") != "Ed25519":
        raise JwsError("unsupported JWK (need OKP Ed25519)")
    if "d" in jwk:
        raise JwsError("refusing private JWK component")
    x = jwk.get("x")
    if not isinstance(x, str):
        raise JwsError("JWK missing x")
    return Ed25519PublicKey.from_public_bytes(b64url_decode(x))


def verify_compact_jws(token: str, jwks: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Verify EdDSA compact JWS against JWKS. Returns (header, payload)."""
    if not HAS_CRYPTO:
        raise JwsError("cryptography package not installed — pip install cryptography")
    parts = token.strip().split(".")
    if len(parts) != 3:
        raise JwsError("not a compact JWS")
    header_b64, payload_b64, sig_b64 = parts
    try:
        header = json.loads(b64url_decode(header_b64))
        payload = json.loads(b64url_decode(payload_b64))
        signature = b64url_decode(sig_b64)
    except Exception as err:  # noqa: BLE001
        raise JwsError(f"malformed JWS: {err}") from err
    if header.get("alg") != "EdDSA":
        raise JwsError(f'unexpected alg "{header.get("alg")}"')
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    kid = header.get("kid")
    ordered = sorted(jwks, key=lambda k: 0 if kid and k.get("kid") == kid else 1)
    for jwk in ordered:
        try:
            key = _public_key_from_okp(jwk)
            key.verify(signature, signing_input)
            return header, payload
        except (JwsError, InvalidSignature, ValueError):
            continue
    raise JwsError("no configured key verifies this JWS")


def verify_status_list_jwt(
    token: str,
    *,
    issuer: str,
    jwks: list[dict[str, Any]],
    now: float | None = None,
    tolerance_sec: int = 60,
) -> dict[str, Any]:
    header, claims = verify_compact_jws(token, jwks)
    if header.get("typ") != "statuslist+jwt":
        raise JwsError(f'unexpected typ "{header.get("typ")}"')
    if claims.get("iss") != issuer:
        raise JwsError(f'status list issued by "{claims.get("iss")}", expected "{issuer}"')
    sl = claims.get("status_list") or {}
    if not isinstance(sl, dict) or not sl.get("lst"):
        raise JwsError("status list is missing its bitstring")
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)):
        raise JwsError("status list missing exp")
    now = time.time() if now is None else now
    if now - tolerance_sec >= exp:
        raise JwsError("status list has expired — refetch before trusting it")
    return claims


def verify_status_list_from_url(
    *,
    status_list_uri: str,
    issuer: str,
    jwks_uri: str,
) -> dict[str, Any]:
    jwks = fetch_jwks(jwks_uri)
    with urllib.request.urlopen(status_list_uri, timeout=30) as resp:
        token = resp.read().decode("utf-8", errors="replace").strip()
    return verify_status_list_jwt(token, issuer=issuer, jwks=jwks)
