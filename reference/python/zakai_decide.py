"""
Zakai Mandate — reference decision implementation, Python, zero dependencies.

WHY THIS FILE EXISTS

A specification written by one party and implemented only by that same party is
not a standard, it is an API with documentation. The question every prospective
adopter actually has is whether somebody who is not us can implement this
correctly from the published material — and the only convincing answer is a
second implementation that passes the same vectors.

WHY IT NEEDS NOTHING INSTALLED

The decision layer performs no cryptography. Signature verification happens
earlier, in whatever JWT library the institution already uses, and by the time
a claim set reaches this code its authenticity is settled. What remains is
policy, and policy is comparisons on a dict.

That matters more than it sounds. "Add a dependency" is a procurement
conversation at a bank; "paste this file" is not. Anything that turns a
ten-minute evaluation into a security review of a supply chain will not happen
this quarter, and a standard nobody evaluates is a standard nobody adopts.

USAGE

    python3 zakai_decide.py                    # run the published vectors
    python3 zakai_decide.py --url <origin>     # fetch vectors from a deployment

Exit code is 0 when every vector passes and 1 otherwise, so this drops into CI.

PORTING NOTES

The ordering of the checks is normative and the vectors pin it. Two rules can
often both fire, and which reason comes back is what integrators branch on. In
particular the forbidden-scope rule precedes every temporal check: an *expired*
token bearing an outward-money scope still means somebody is issuing forbidden
mandates, which is a registry-level incident rather than a stale credential,
and reporting "expired" would hide it behind the lesser fault.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Iterable

DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app"
VECTORS_PATH = "/api/mandate/test-vectors"

# Scopes no mandate may ever carry, from any issuer. Money only ever flows
# toward the principal; an agent that cannot spend is a categorically different
# risk object from one that can, and that limit is what makes these acceptable
# to a regulated institution at all.
# Prohibitions are global, not per sector. A finance mandate can no more carry
# a health prohibition than an outward-money one — otherwise an issuer reaches a
# forbidden act simply by declaring itself to be in a different sector, which is
# a formality rather than a limit.
#
# Only finance is issuable today; the rest are reserved with their limits fixed
# in advance, because a categorical limit decided after a sector's first
# customer asks for an exception is a negotiating position, not a limit.
FORBIDDEN_SCOPES = frozenset(
    {
        # finance
        "payment:initiate",
        "payment:transfer",
        "credit:borrow",
        "account:open",
        "account:close",
        "investment:trade",
        # health — never consent to or refuse treatment, never alter a record
        "treatment:consent",
        "treatment:refuse",
        "record:alter",
        "prescription:request",
        "directive:amend",
        # government — never waive a right, plead, or surrender a status
        "right:waive",
        "plea:enter",
        "claim:withdraw",
        "status:surrender",
        "appeal:abandon",
        # employment — never resign, accept termination, or sign a term
        "employment:resign",
        "termination:accept",
        "contract:sign",
        "grievance:withdraw",
        # housing — never sign, surrender or concede a tenancy
        "tenancy:sign",
        "tenancy:surrender",
        "possession:concede",
        "deposit:forfeit",
        # education — never withdraw an enrolment or alter an attainment
        "enrolment:withdraw",
        "sanction:accept",
        "attainment:alter",
    }
)


def is_forbidden(scope: str) -> bool:
    """Refused whatever domain claims it, prefixed or bare.

    A limit somebody can step around by adding a prefix is not a limit.
    """
    if scope in FORBIDDEN_SCOPES:
        return True
    _, sep, bare = scope.partition("/")
    return bool(sep) and bare in FORBIDDEN_SCOPES

# Scopes whose grant is standing, and those that need the principal to confirm
# each individual exercise. Holding "may cancel my subscriptions" is not
# agreement to cancel this one — the rule implementations most often miss.
STANDING_SCOPES = frozenset(
    {
        "read:accounts",
        "read:transactions",
        "read:credit",
        "read:bills",
        "read:policies",
        "read:payroll",
        "read:tax",
    }
)

PER_ACT_SCOPES = frozenset(
    {
        "claim:submit",
        "claim:appeal",
        "dispute:charge",
        "negotiate:tariff",
        "contract:cancel",
        "contract:switch",
        "settle:receive",
    }
)

# Known, and standing despite not being a read scope. Worth its own name: the
# first draft of this file assumed tier and per-act confirmation were the same
# question, which put `request:records` in the wrong set. Asking somebody to
# confirm each individual request for their own records is friction with no
# safety behind it, and a vector now pins the distinction.
OTHER_STANDING_SCOPES = frozenset({"request:records"})

KNOWN_SCOPES = STANDING_SCOPES | PER_ACT_SCOPES | OTHER_STANDING_SCOPES


@dataclass
class Decision:
    decision: str  # "permit" | "deny"
    reason: str | None = None
    obligations: list[str] = field(default_factory=list)

    def key(self) -> str:
        return f"{self.decision}:{self.reason}" if self.reason else self.decision


def _deny(reason: str) -> Decision:
    return Decision("deny", reason)


def decide(
    claims: dict[str, Any],
    action: str,
    audience: str,
    *,
    now: int,
    subject: str | None = None,
    market: str | None = None,
    revocation: str = "unknown",
    act_confirmation: str | None = None,
) -> Decision:
    """May this agent do this, now?

    Total by construction: every input yields a decision and none raises. A
    function a bank wraps in try/except is one whose except block will
    eventually permit something.
    """
    # Structural mismatches first. "You sent this to the wrong institution" is
    # more useful to an integrator than "that scope is missing".
    if claims.get("aud") != audience:
        return _deny("audience_mismatch")
    if subject and claims.get("sub") != subject:
        return _deny("subject_mismatch")
    if market and claims.get("market") and claims.get("market") != market:
        return _deny("market_mismatch")

    # The categorical limit, before anything temporal. See the porting note.
    if is_forbidden(action):
        return _deny("scope_forbidden")
    if any(is_forbidden(s) for s in claims.get("scopes") or ()):
        return _deny("scope_forbidden")

    exp, nbf = claims.get("exp"), claims.get("nbf")
    # A missing expiry is malformed, never eternal. Treating its absence as "no
    # expiry" turns a broken token into the strongest possible mandate arriving
    # through the weakest possible path.
    if not isinstance(exp, int) or not isinstance(nbf, int):
        return _deny("malformed_claims")
    if now < nbf:
        return _deny("not_yet_valid")
    if now >= exp:
        return _deny("expired")

    if action not in KNOWN_SCOPES:
        return _deny("scope_unknown")
    if action not in (claims.get("scopes") or ()):
        return _deny("scope_not_granted")

    if action in PER_ACT_SCOPES and not (act_confirmation or "").strip():
        return _deny("act_confirmation_required")

    if revocation == "revoked":
        return _deny("revoked")
    if revocation != "active":
        # Not a permit with a warning. An institution that cannot establish
        # revocation status has not established authority, and softening this is
        # how a revoked mandate keeps working for the one caller who never checks.
        return _deny("revocation_unknown")

    obligations = [f"record:{claims.get('jti')}", f"notify_principal:{action}"]
    if (act_confirmation or "").strip():
        obligations.append(f"retain_confirmation:{act_confirmation.strip()}")
    return Decision("permit", None, obligations)


# ---------------------------------------------------------------------------
# Conformance runner
# ---------------------------------------------------------------------------


def load_vectors(source: str) -> dict[str, Any]:
    """Fetch from a deployment, or read a local copy.

    The local path matters for CI in an environment with no outbound network,
    which is most of the ones that would actually be evaluating this.
    """
    if not source.startswith(("http://", "https://")):
        with open(source, encoding="utf-8") as handle:
            return json.load(handle)
    with urllib.request.urlopen(source.rstrip("/") + VECTORS_PATH, timeout=30) as resp:
        return json.load(resp)


def run(doc: dict[str, Any]) -> tuple[int, list[str]]:
    """Evaluate every vector at the document's fixed instant.

    Never the wall clock: a vector evaluated against the current time is a test
    that passes today and fails on the day somebody actually runs it.
    """
    now = int(doc["evaluated_at_unix"])
    failures: list[str] = []

    for vector in doc["vectors"]:
        expect = vector["expect"]
        expected = (
            f"{expect['decision']}:{expect['reason']}"
            if expect.get("reason")
            else expect["decision"]
        )
        try:
            got = decide(
                vector["claims"],
                vector["action"],
                vector["audience"],
                now=now,
                subject=vector.get("subject"),
                market=vector.get("market"),
                revocation=vector.get("revocation", "unknown"),
                act_confirmation=vector.get("act_confirmation"),
            ).key()
        except Exception as err:  # noqa: BLE001 - a throw is a failure, not a crash
            got = f"threw:{err}"

        if got != expected:
            failures.append(f"  {vector['id']}: expected {expected}, got {got}\n    pins: {vector['pins']}")

    return len(doc["vectors"]), failures


def main(argv: Iterable[str]) -> int:
    args = list(argv)
    source = DEFAULT_ORIGIN
    if "--url" in args:
        source = args[args.index("--url") + 1]
    elif "--file" in args:
        source = args[args.index("--file") + 1]

    try:
        doc = load_vectors(source)
    except Exception as err:  # noqa: BLE001
        print(f"could not load vectors from {source}: {err}", file=sys.stderr)
        return 2

    total, failures = run(doc)
    if failures:
        print(f"NOT CONFORMANT — {len(failures)} of {total} vectors failed:\n")
        print("\n".join(failures))
        # No partial credit. One wrong answer in a trust network is one
        # participant honouring something nobody else does.
        return 1

    print(f"CONFORMANT — {total}/{total} vectors passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
