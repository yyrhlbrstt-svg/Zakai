#!/usr/bin/env python3
"""Minimal Zakai inbound receive — stdlib HTTP server + jwt via PyJWT if present.

    pip install PyJWT cryptography
    python3 receive.py

Resolves the issuer through the published trust registry, then verifies EdDSA
against that issuer's JWKS (same network rule as /api/pipe/accept).
"""

from __future__ import annotations

import base64
import gzip
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

ORIGIN = os.environ.get("ZAKAI_ORIGIN", "https://zakai-3uxj.vercel.app").rstrip("/")
REGISTRY_URL = os.environ.get(
    "ZAKAI_TRUST_REGISTRY_URL", f"{ORIGIN}/.well-known/zakai-trust-registry.json"
)
MARK_URL = f"{ORIGIN}/api/pipe/mark"
PORT = int(os.environ.get("PORT", "8790"))
SEEN: set[str] = set()
FORBIDDEN = {"pay:transfer", "pay:card", "wallet:debit", "funds:move", "payment:initiate"}


def status_url(jti: str) -> str:
    tmpl = os.environ.get("ZAKAI_STATUS_URL_TEMPLATE")
    if tmpl:
        return tmpl.replace("{jti}", urllib.parse.quote(jti, safe=""))
    return f"{ORIGIN}/api/mandate/status/{urllib.parse.quote(jti, safe='')}"


def load_registry() -> dict:
    with urllib.request.urlopen(REGISTRY_URL, timeout=10) as r:
        return json.load(r)


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def read_status_bit(lst: str, index: int) -> bool:
    if not isinstance(index, int) or index < 0:
        return False
    raw = gzip.decompress(_b64url_decode(lst))
    byte = index >> 3
    if byte >= len(raw):
        return False
    return (raw[byte] & (1 << (index & 7))) != 0


def check_status_list(jti: str, status: dict, jwks_uri: str, issuer_iss: str) -> tuple[int, dict]:
    """Prefer offline statuslist+jwt when the mandate embeds zkm.status."""
    try:
        idx = status.get("idx")
        uri = status.get("uri")
        if not isinstance(idx, int) or idx < 0 or not isinstance(uri, str) or not uri:
            return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "status_list"}

        import jwt  # type: ignore
        from jwt import PyJWKClient  # type: ignore

        with urllib.request.urlopen(uri, timeout=10) as r:
            list_token = r.read().decode("utf-8", errors="replace").strip()
        client = PyJWKClient(jwks_uri)
        key = client.get_signing_key_from_jwt(list_token)
        header = jwt.get_unverified_header(list_token)
        if header.get("typ") != "statuslist+jwt":
            return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "status_list"}
        claims = jwt.decode(
            list_token,
            key.key,
            algorithms=["EdDSA"],
            options={"verify_aud": False},
        )
        if claims.get("iss") != issuer_iss:
            return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "status_list"}
        lst = (claims.get("status_list") or {}).get("lst")
        if not lst:
            return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "status_list"}
        if read_status_bit(lst, idx):
            return 401, {"error": "revoked", "mandate_jti": jti, "via": "status_list"}
        return 200, {"status": "active", "via": "status_list"}
    except Exception:
        return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "status_list"}


def check_revocation_live(jti: str) -> tuple[int, dict]:
    """Live /status/{jti}. Fail closed when status is unknown/unreachable."""
    try:
        req = urllib.request.Request(status_url(jti), headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            doc = json.load(r)
    except urllib.error.HTTPError as err:
        if err.code == 503:
            return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "live_status"}
        return 503, {
            "error": "revocation_unknown",
            "mandate_jti": jti,
            "via": "live_status",
            "detail": f"status_{err.code}",
        }
    except Exception:
        return 503, {"error": "revocation_unknown", "mandate_jti": jti, "via": "live_status"}

    status = doc.get("status")
    if status == "revoked":
        return 401, {"error": "revoked", "mandate_jti": jti, "via": "live_status"}
    if status != "active":
        return 503, {
            "error": "revocation_unknown",
            "mandate_jti": jti,
            "via": "live_status",
            "status": status,
        }
    return 200, {**doc, "via": "live_status"}


def check_revocation(jti: str, claims: dict, jwks_uri: str, issuer_iss: str) -> tuple[int, dict]:
    zkm = claims.get("zkm") if isinstance(claims.get("zkm"), dict) else {}
    status = zkm.get("status") if isinstance(zkm, dict) else None
    if isinstance(status, dict):
        return check_status_list(jti, status, jwks_uri, issuer_iss)
    return check_revocation_live(jti)


def unverified_iss(token: str) -> str:
    import base64

    mid = token.split(".")[1]
    pad = "=" * (-len(mid) % 4)
    raw = json.loads(base64.urlsafe_b64decode(mid + pad))
    return str(raw.get("iss") or "")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "registry": REGISTRY_URL,
                    "acceptor_mark": MARK_URL,
                },
            )
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/webhooks/zakai-inbound":
            self.send_response(404)
            self.end_headers()
            return
        n = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(n))
        except Exception:
            self._json(400, {"error": "malformed"})
            return
        jti = body.get("mandate_jti")
        token = body.get("mandate_jws")
        if not jti or not token:
            self._json(400, {"error": "missing_fields"})
            return
        idem = self.headers.get("Idempotency-Key")
        if idem and idem != jti:
            self._json(400, {"error": "idempotency_mismatch"})
            return
        if jti in SEEN:
            self._json(409, {"error": "duplicate", "mandate_jti": jti})
            return
        try:
            import jwt  # type: ignore
            from jwt import PyJWKClient  # type: ignore

            iss = unverified_iss(token)
            registry = load_registry()
            issuer = next(
                (
                    i
                    for i in registry.get("issuers", [])
                    if i.get("iss") == iss and i.get("status") == "active"
                ),
                None,
            )
            if not issuer:
                self._json(401, {"error": "unknown_or_inactive_issuer", "iss": iss})
                return

            jwks_uri = issuer.get("jwks_uri") or issuer.get("jwksUri")
            client = PyJWKClient(jwks_uri)
            key = client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key.key,
                algorithms=["EdDSA"],
                options={"verify_aud": False},
            )
            if claims.get("jti") != jti:
                raise ValueError("jti_mismatch")
            scopes = str(claims.get("scope") or "").split()
            hit = [s for s in scopes if s in FORBIDDEN]
            if hit:
                self._json(422, {"error": "forbidden_scope", "scopes": hit})
                return
            allowed = issuer.get("allowed_scopes") or issuer.get("allowedScopes") or []
            if allowed and any(s not in allowed for s in scopes):
                self._json(422, {"error": "issuer_scope_exceeded", "scopes": scopes})
                return
            # Prefer signed status list when zkm.status is present; else live.
            code, status_body = check_revocation(jti, claims, jwks_uri, issuer.get("iss") or iss)
            if code != 200:
                self._json(code, status_body)
                return
            SEEN.add(jti)
            self._json(
                202,
                {
                    "accepted": True,
                    "mandate_jti": jti,
                    "intent": body.get("intent"),
                    "issuer": {"iss": issuer.get("iss"), "name": issuer.get("name")},
                    "acceptor_mark": MARK_URL,
                },
            )
        except Exception as err:
            self._json(401, {"error": "mandate_rejected", "reason": str(err)})

    def _json(self, code: int, obj: dict) -> None:
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt: str, *args) -> None:
        return


if __name__ == "__main__":
    print(f"zakai inbound receiver on :{PORT} (registry {REGISTRY_URL})")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
