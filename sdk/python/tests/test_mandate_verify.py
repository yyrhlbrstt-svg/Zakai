"""Offline unit checks — no network. Forbidden scopes + audience."""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(ROOT))

from zakai_mandate.scopes import FORBIDDEN_SCOPES, contains_forbidden  # noqa: E402
from zakai_mandate.jws import JwsError  # noqa: E402
from zakai_mandate.mandate import verify_mandate  # noqa: E402


def test_forbidden_scopes_match_known_money_acts():
    assert "payment:initiate" in FORBIDDEN_SCOPES
    assert "payment:transfer" in FORBIDDEN_SCOPES
    assert contains_forbidden(["contract:cancel", "payment:initiate"]) == ["payment:initiate"]
    assert contains_forbidden(["contract:cancel"]) == []


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def test_verify_mandate_rejects_bad_shape_without_crypto_keys():
    # Malformed compact JWS — should fail before any network.
    with pytest.raises(JwsError):
        verify_mandate("not.a.jws", audience="bank-x", jwks=[])


def test_audience_helper_via_claims_shape():
    # Ensure scope parsing + forbidden rejection works when crypto is present.
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    except ImportError:
        pytest.skip("cryptography not installed")

    priv = Ed25519PrivateKey.generate()
    pub = priv.public_key()
    raw_pub = pub.public_bytes_raw()
    jwk = {
        "kty": "OKP",
        "crv": "Ed25519",
        "x": _b64(raw_pub),
        "kid": "t1",
        "alg": "EdDSA",
    }
    header = _b64(json.dumps({"alg": "EdDSA", "typ": "JWT", "kid": "t1"}).encode())
    payload = _b64(
        json.dumps(
            {
                "aud": "bank-x",
                "exp": 4_000_000_000,
                "nbf": 1,
                "scope": "contract:cancel payment:initiate",
            }
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    sig = _b64(priv.sign(signing_input))
    token = f"{header}.{payload}.{sig}"
    with pytest.raises(JwsError, match="forbidden"):
        verify_mandate(token, audience="bank-x", jwks=[jwk])
