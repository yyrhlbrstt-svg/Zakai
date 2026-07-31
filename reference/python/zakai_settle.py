"""
Zakai Settlement — reference adjudication, Python, zero dependencies.

WHY THIS ONE MATTERS MORE THAN THE AUTHORIZATION REFERENCE

The decision layer compares values. This layer hashes records, and hashing is
where signed-record formats actually break between languages. Two
implementations that serialise the same object differently — a different key
order, a differently handled absent field, a float where the other has an int —
compute different hashes, reject each other's perfectly valid chains, and each
concludes the other's cryptography is at fault.

So the canonicalisation is written out explicitly below rather than left to
whatever `json.dumps` happens to do, and the published vectors carry hash
fixtures you should check before looking at a single verdict. An implementation
that produces the right verdicts from the wrong hashes has agreed with nobody:
it works on chains it built itself and fails on every chain built by anyone
else.

    python3 zakai_settle.py --file settlement-vectors.json
    python3 zakai_settle.py --url https://zakai-3uxj.vercel.app

Exit code is 0 when every vector and every hash fixture passes, 1 otherwise.
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from typing import Any

DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app"
VECTORS_PATH = "/api/settlement/test-vectors"

_UNSET = object()


def canonical(value: Any) -> str:
    """Serialise so two implementations produce identical bytes.

    Three rules, and each is a place implementations silently diverge:

      * object keys sorted by code unit, ascending
      * fields whose value is absent are omitted entirely, so an absent field
        and an explicitly-null-because-unset one hash identically
      * no insignificant whitespace; arrays keep their order

    Python's ``None`` is used for JSON ``null``, which is a real value and is
    kept. The omitted case is a key that is simply not present — this function
    never sees it — plus the sentinel below, which exists so a caller porting
    from a language with an explicit "undefined" has somewhere to put it.
    """
    if value is _UNSET:
        raise ValueError("unset values must be omitted, not serialised")
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float)):
        # Integers only, in practice: money is always minor units and never a
        # float. A float that is integral is emitted without a decimal point so
        # it matches a language that carried it as an integer.
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical(v) for v in value) + "]"
    if isinstance(value, dict):
        items = sorted((k, v) for k, v in value.items() if v is not _UNSET)
        return "{" + ",".join(f"{json.dumps(k, ensure_ascii=False)}:{canonical(v)}" for k, v in items) + "}"
    raise TypeError(f"cannot canonicalise {type(value)!r}")


def hash_record(record: Any) -> str:
    return hashlib.sha256(canonical(record).encode("utf-8")).hexdigest()


def _verdict(verdict: str, burden: str, settled: int = 0) -> dict[str, Any]:
    return {"verdict": verdict, "burden": burden, "settledMinor": settled}


def adjudicate(chain: dict[str, Any], now: int) -> dict[str, Any]:
    """Who is right, from the records alone.

    Pure and total: every input yields a verdict and none raises. A function a
    bank wraps in try/except is one whose except block will eventually decide a
    dispute.
    """
    mandate = chain["mandate"]
    decision = chain.get("decision")
    outcome = chain.get("outcome")

    # An outcome with no decision before it is the case this layer exists for:
    # something was done and nobody can point at the permission for it.
    if outcome and not decision:
        return _verdict("unauthorized", "institution")
    if not decision:
        # A real verdict, not a failure. A procedure that always produces a
        # winner will sometimes invent one.
        return _verdict("indeterminate", "none")

    if decision.get("mandateJti") != mandate.get("jti"):
        return _verdict("broken_chain", "institution")
    if decision.get("prevHash") != mandate.get("hash"):
        return _verdict("broken_chain", "institution")

    if decision.get("decision") == "deny":
        # A refusal is a recorded answer, not a fault. Treating it as fault is
        # how a network punishes the participants who behave correctly.
        if outcome and outcome.get("result") != "refused":
            return _verdict("unauthorized", "institution")
        return _verdict("refused_with_reason", "none")

    at = decision.get("at")
    if at < mandate["nbf"] or at >= mandate["exp"]:
        return _verdict("outside_mandate_window", "institution")
    if decision.get("action") not in (mandate.get("scopes") or ()):
        return _verdict("exceeded_scope", "institution")

    if not outcome:
        # The verdict that makes silence expensive, which is the point: the
        # burden sits with the party holding the record of what it did.
        return _verdict("authorized_not_performed", "institution")

    if outcome.get("prevHash") != hash_record(decision):
        return _verdict("broken_chain", "institution")
    if outcome.get("action") != decision.get("action"):
        return _verdict("exceeded_scope", "institution")
    if outcome.get("at") < at:
        return _verdict("broken_chain", "institution")
    if outcome.get("at") >= mandate["exp"]:
        return _verdict("outside_mandate_window", "institution")

    if outcome.get("result") == "refused":
        return _verdict("refused_with_reason", "none")

    amount = outcome.get("amountMinor") or 0
    # Negative or fractional money is refused rather than coerced. A settlement
    # layer that quietly rounds is one whose totals stop reconciling, and the
    # first party to notice will be the one owed the rounding.
    if isinstance(amount, bool) or not isinstance(amount, int) or amount < 0:
        if not (isinstance(amount, float) and float(amount).is_integer() and amount >= 0):
            return _verdict("indeterminate", "institution")
        amount = int(amount)

    return _verdict("performed_as_authorized", "none", int(amount))


# ---------------------------------------------------------------------------
# Conformance runner
# ---------------------------------------------------------------------------


def load(source: str) -> dict[str, Any]:
    if not source.startswith(("http://", "https://")):
        with open(source, encoding="utf-8") as handle:
            return json.load(handle)
    with urllib.request.urlopen(source.rstrip("/") + VECTORS_PATH, timeout=30) as resp:
        return json.load(resp)


def main(argv: list[str]) -> int:
    source = DEFAULT_ORIGIN
    for i, arg in enumerate(argv[:-1]):
        if arg in ("--url", "--file"):
            source = argv[i + 1]

    try:
        doc = load(source)
    except Exception as err:  # noqa: BLE001
        print(f"could not load vectors from {source}: {err}", file=sys.stderr)
        return 2

    # Hashes first. A right verdict from a wrong hash is agreement about
    # nothing, so there is no point reading the verdicts until this passes.
    hash_failures = []
    for fixture in doc["canonicalisation"]["fixtures"]:
        got = hash_record(fixture["record"])
        if got != fixture["sha256"]:
            hash_failures.append(f"  canonical hash mismatch\n    expected {fixture['sha256']}\n    got      {got}")

    if hash_failures:
        print("NOT CONFORMANT - canonicalisation differs:\n")
        print("\n".join(hash_failures))
        return 1

    now = int(doc["evaluated_at_unix"])
    failures = []
    for v in doc["vectors"]:
        expect = v["expect"]
        expected = f"{expect['verdict']}/{expect['burden']}/{expect['settledMinor']}"
        try:
            got_obj = adjudicate(v["chain"], now)
            got = f"{got_obj['verdict']}/{got_obj['burden']}/{got_obj['settledMinor']}"
        except Exception as err:  # noqa: BLE001 - a throw is a failure, not a crash
            got = f"threw:{err}"
        if got != expected:
            failures.append(f"  {v['id']}: expected {expected}, got {got}\n    pins: {v['pins']}")

    total = len(doc["vectors"])
    if failures:
        # No partial credit: one wrong verdict in a settlement network is one
        # dispute resolved differently depending on who was asked.
        print(f"NOT CONFORMANT - {len(failures)} of {total} vectors failed:\n")
        print("\n".join(failures))
        return 1

    print(f"CONFORMANT - {total}/{total} vectors and {len(doc['canonicalisation']['fixtures'])} hash fixtures passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
