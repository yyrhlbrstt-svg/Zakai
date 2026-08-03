#!/usr/bin/env python3
"""
Zakai Mandate — Python verify client.

Paths:
  1) Offline crypto (preferred when cryptography is installed):
       pip install -r requirements-sdk.txt
       python3 zakai_verify.py --ready --origin https://zakai-3uxj.vercel.app
     Verifies the signed statuslist+jwt against JWKS (same bar as Node SDK).
  2) Stdlib smoke (no pip): vectors + fetchable Status List shape only.
  3) HTTP mandate verify: POST /api/mandate/verify for one JWS.

Usage:
  python3 zakai_verify.py --ready [--origin …]
  python3 zakai_verify.py --status-only [--origin …]
  python3 zakai_verify.py --jws <compact> [--origin …]

Exit 0 on success. Never invents permit on error.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app"


def http_json(method: str, url: str, body: dict | None = None, timeout: int = 30) -> tuple[int, object]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, {"error": raw}


def http_text(url: str, timeout: int = 30) -> tuple[int, str, str]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.headers.get("Content-Type", ""), resp.read().decode("utf-8", errors="replace")


def verify_jws(origin: str, jws: str, audience: str) -> int:
    status, payload = http_json(
        "POST",
        f"{origin.rstrip('/')}/api/mandate/verify",
        {"mandate": jws, "audience": audience},
    )
    if status != 200:
        print(f"verify: FAILED HTTP {status} — {payload}", file=sys.stderr)
        return 1
    print("verify: OK")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def check_status_list_crypto(origin: str) -> int:
    """Cryptographic Status List verify — same gate as Node `npm run ready`."""
    try:
        from zakai_jws import HAS_CRYPTO, JwsError, verify_status_list_from_url
    except ImportError as err:
        print(f"status list crypto: FAILED — {err}", file=sys.stderr)
        return 1
    if not HAS_CRYPTO:
        print(
            "status list crypto: SKIPPED — pip install -r requirements-sdk.txt",
            file=sys.stderr,
        )
        return 2
    base = origin.rstrip("/")
    try:
        claims = verify_status_list_from_url(
            status_list_uri=f"{base}/api/mandate/revocations",
            issuer=base,
            jwks_uri=f"{base}/.well-known/zakai-jwks.json",
        )
    except (JwsError, Exception) as err:  # noqa: BLE001
        print(f"status list crypto: FAILED — {err}", file=sys.stderr)
        return 1
    print(
        "status list: VERIFIED — typ=statuslist+jwt "
        f"iss={claims.get('iss')!r} exp={claims.get('exp')}"
    )
    return 0


def check_status_list_smoke(origin: str) -> int:
    url = f"{origin.rstrip('/')}/api/mandate/revocations"
    try:
        status, ctype, body = http_text(url)
    except Exception as err:  # noqa: BLE001
        print(f"status list: FAILED — {err}", file=sys.stderr)
        return 1
    if status != 200:
        print(f"status list: FAILED HTTP {status}", file=sys.stderr)
        return 1
    if "statuslist" not in ctype and body.count(".") != 2:
        print(f"status list: unexpected content-type {ctype!r}", file=sys.stderr)
        return 1
    parts = body.strip().split(".")
    if len(parts) != 3:
        print("status list: not a compact JWS", file=sys.stderr)
        return 1
    print(
        f"status list: FETCHED — content-type={ctype!r} bytes={len(body)} "
        "(smoke only — install cryptography for signature verify)."
    )
    return 0


def check_status_list(origin: str) -> int:
    crypto = check_status_list_crypto(origin)
    if crypto == 0:
        return 0
    if crypto == 1:
        return 1
    # cryptography missing → smoke fallback (not READY_FOR_PIONEER crypto bar)
    return check_status_list_smoke(origin)


def run_ready(origin: str) -> int:
    decide = Path(__file__).with_name("zakai_decide.py")
    print(f"running authorization vectors via {decide.name} …")
    vec = subprocess.run(
        [sys.executable, str(decide), "--url", origin],
        check=False,
    )
    st = check_status_list_crypto(origin)
    if st == 2:
        # No cryptography — refuse READY so we don't overclaim vs Node.
        print(
            "NOT_READY — install cryptography for Status List signature verify:\n"
            "  pip install -r requirements-sdk.txt",
            file=sys.stderr,
        )
        smoke = check_status_list_smoke(origin)
        return 1 if smoke != 0 or vec.returncode != 0 else 1
    if vec.returncode == 0 and st == 0:
        print("READY_FOR_PIONEER")
        print(f"Next: {origin.rstrip('/')}/he/institutions/leader")
        return 0
    print("NOT_READY", file=sys.stderr)
    return 1


def main() -> int:
    p = argparse.ArgumentParser(description="Zakai Mandate Python verify")
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--jws", help="Compact JWS mandate to verify via HTTP")
    p.add_argument(
        "--audience",
        default="",
        help="JWT aud / institution slug (required with --jws)",
    )
    p.add_argument("--status-only", action="store_true")
    p.add_argument(
        "--ready",
        action="store_true",
        help="vectors + cryptographically verified Status List (needs cryptography)",
    )
    args = p.parse_args()
    origin = args.origin.rstrip("/")

    if args.ready:
        return run_ready(origin)
    if args.status_only:
        return check_status_list(origin)
    if not args.jws:
        p.error("provide --jws, --status-only, or --ready")
    if not args.audience.strip():
        p.error("--audience is required with --jws (institution slug / JWT aud)")
    return verify_jws(origin, args.jws, args.audience.strip())


if __name__ == "__main__":
    raise SystemExit(main())
