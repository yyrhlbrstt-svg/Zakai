#!/usr/bin/env python3
"""
Zakai Mandate — thin Python verify client (stdlib only).

Banks that cannot add npm still need a 15-minute path:
  1) POST /api/mandate/verify  (crypto against published JWKS on our side,
     or swap in your own JWT library later)
  2) GET  /api/mandate/revocations  (signed statuslist+jwt — cache it)
  3) python3 zakai_decide.py        (offline policy vectors)

Usage:
  python3 zakai_verify.py --jws <compact> [--origin https://zakai-3uxj.vercel.app]
  python3 zakai_verify.py --status-only
  python3 zakai_verify.py --ready   # vectors (via zakai_decide) + status list HTTP check

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


def verify_jws(origin: str, jws: str) -> int:
    status, payload = http_json("POST", f"{origin.rstrip('/')}/api/mandate/verify", {"mandate": jws})
    if status != 200:
        print(f"verify: FAILED HTTP {status} — {payload}", file=sys.stderr)
        return 1
    print("verify: OK")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def check_status_list(origin: str) -> int:
    url = f"{origin.rstrip('/')}/api/mandate/revocations"
    try:
        status, ctype, body = http_text(url)
    except Exception as err:  # noqa: BLE001
        print(f"status list: FAILED — {err}", file=sys.stderr)
        return 1
    if status != 200:
        print(f"status list: FAILED HTTP {status}", file=sys.stderr)
        return 1
    if "statuslist" not in ctype and not body.count(".") == 2:
        print(f"status list: unexpected content-type {ctype!r}", file=sys.stderr)
        return 1
    # Signature verification belongs in your JWT stack (or Node SDK
    # verifyStatusListFromUrl). Here we only prove the artefact is fetchable
    # and shaped like a compact JWS — enough for a 15-minute smoke.
    parts = body.strip().split(".")
    if len(parts) != 3:
        print("status list: not a compact JWS", file=sys.stderr)
        return 1
    print(f"status list: FETCHED — content-type={ctype!r} bytes={len(body)} (verify signature with JWKS offline).")
    return 0


def run_ready(origin: str) -> int:
    decide = Path(__file__).with_name("zakai_decide.py")
    print(f"running authorization vectors via {decide.name} …")
    vec = subprocess.run(
        [sys.executable, str(decide), "--url", origin],
        check=False,
    )
    st = check_status_list(origin)
    if vec.returncode == 0 and st == 0:
        print("READY_FOR_PIONEER")
        print(f"Next: {origin.rstrip('/')}/he/institutions/leader")
        return 0
    print("NOT_READY", file=sys.stderr)
    return 1


def main() -> int:
    p = argparse.ArgumentParser(description="Zakai Mandate Python verify (stdlib)")
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--jws", help="Compact JWS mandate to verify via HTTP")
    p.add_argument("--status-only", action="store_true")
    p.add_argument("--ready", action="store_true", help="vectors + status list smoke")
    args = p.parse_args()
    origin = args.origin.rstrip("/")

    if args.ready:
        return run_ready(origin)
    if args.status_only:
        return check_status_list(origin)
    if not args.jws:
        p.error("provide --jws, --status-only, or --ready")
    return verify_jws(origin, args.jws)


if __name__ == "__main__":
    raise SystemExit(main())
