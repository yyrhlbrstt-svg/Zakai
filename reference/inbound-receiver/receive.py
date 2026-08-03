#!/usr/bin/env python3
"""Minimal Zakai inbound receive — stdlib HTTP server + jwt via PyJWT if present.

    pip install PyJWT cryptography
    python3 receive.py

Resolves the issuer through the published trust registry, then verifies EdDSA
against that issuer's JWKS (same network rule as /api/pipe/accept).
"""

from __future__ import annotations

import json
import os
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


def load_registry() -> dict:
    with urllib.request.urlopen(REGISTRY_URL, timeout=10) as r:
        return json.load(r)


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
