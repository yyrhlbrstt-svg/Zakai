"""Status-list bit helpers — offline, no network for read_status."""

from __future__ import annotations

import base64
import gzip
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(ROOT))

from zakai_mandate.jws import read_status, status_list_revocation_state  # noqa: E402


def _lst(bytes_: bytes) -> str:
    return base64.urlsafe_b64encode(gzip.compress(bytes_)).rstrip(b"=").decode("ascii")


def test_read_status_set_and_unset_bits():
    raw = bytearray(2)
    raw[0] = 0b0000_0010  # index 1 revoked
    lst = _lst(bytes(raw))
    assert read_status(lst, 0) is False
    assert read_status(lst, 1) is True
    assert read_status(lst, 9) is False  # beyond length → not revoked
    assert read_status(lst, -1) is False


def test_status_list_revocation_state_fails_closed_on_bad_uri():
    state = status_list_revocation_state(
        {"idx": 0, "uri": "https://127.0.0.1:1/does-not-exist"},
        issuer="https://issuer.test",
        jwks_uri="https://127.0.0.1:1/jwks",
    )
    assert state == "unknown"


def test_status_list_revocation_state_rejects_malformed_status():
    assert (
        status_list_revocation_state(
            {"idx": -1, "uri": "https://issuer.test/status"},
            issuer="https://issuer.test",
            jwks_uri="https://issuer.test/jwks",
        )
        == "unknown"
    )
    assert (
        status_list_revocation_state(
            {"idx": 0, "uri": ""},
            issuer="https://issuer.test",
            jwks_uri="https://issuer.test/jwks",
        )
        == "unknown"
    )


@pytest.mark.skipif(
    __import__("importlib").util.find_spec("cryptography") is None,
    reason="cryptography not installed",
)
def test_status_list_revocation_state_reads_signed_list():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    import json
    import time
    import base64 as b64

    priv = Ed25519PrivateKey.generate()
    pub = priv.public_key()
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    pub_raw = pub.public_bytes(Encoding.Raw, PublicFormat.Raw)
    jwk = {
        "kty": "OKP",
        "crv": "Ed25519",
        "x": b64.urlsafe_b64encode(pub_raw).rstrip(b"=").decode("ascii"),
        "kid": "py-status-test",
        "alg": "EdDSA",
    }

    raw = bytearray(1)
    raw[0] = 0b0000_0100  # index 2 revoked
    lst = _lst(bytes(raw))
    now = int(time.time())
    payload = {
        "iss": "https://issuer.test",
        "iat": now,
        "exp": now + 3600,
        "status_list": {"bits": 1, "lst": lst},
    }
    header = {"alg": "EdDSA", "typ": "statuslist+jwt", "kid": "py-status-test"}

    def b64url(data: bytes) -> str:
        return b64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    signing_input = f"{b64url(json.dumps(header, separators=(',', ':')).encode())}.{b64url(json.dumps(payload, separators=(',', ':')).encode())}".encode()
    sig = priv.sign(signing_input)
    token = f"{signing_input.decode()}.{b64url(sig)}"

    from zakai_mandate.jws import verify_status_list_jwt, read_status as rs

    claims = verify_status_list_jwt(token, issuer="https://issuer.test", jwks=[jwk])
    assert rs(claims["status_list"]["lst"], 2) is True
    assert rs(claims["status_list"]["lst"], 0) is False
