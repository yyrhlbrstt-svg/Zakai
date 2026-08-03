#!/usr/bin/env python3
"""Minimal Zakai inbound receive — stdlib HTTP server + jwt via PyJWT if present.

    pip install PyJWT cryptography
    python3 receive.py

Verifies EdDSA against the published JWKS URL.
"""

from __future__ import annotations

import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

JWKS_URL = os.environ.get(
    "ZAKAI_JWKS_URL", "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json"
)
PORT = int(os.environ.get("PORT", "8790"))
SEEN: set[str] = set()
FORBIDDEN = {"pay:transfer", "pay:card", "wallet:debit", "funds:move"}


def load_jwks() -> dict:
    with urllib.request.urlopen(JWKS_URL, timeout=10) as r:
        return json.load(r)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(200, {"ok": True, "jwks": JWKS_URL})
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

            client = PyJWKClient(JWKS_URL)
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
            SEEN.add(jti)
            self._json(202, {"accepted": True, "mandate_jti": jti, "intent": body.get("intent")})
        except Exception as err:
            self._json(401, {"error": "mandate_rejected", "reason": str(err)})

    def _json(self, code: int, obj: dict) -> None:
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt: str, *args) -> None:  # quieter
        return


if __name__ == "__main__":
    print(f"zakai inbound receiver on :{PORT} (JWKS {JWKS_URL})")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
