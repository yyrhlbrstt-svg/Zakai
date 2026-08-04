#!/usr/bin/env bash
# Run every reference implementation against the published vectors.
#
# This is the artefact, not any single implementation. Independent programs, in
# different languages, agreeing on every case — including the ones where two
# rules could both fire and the answer returned is what an integrator branches
# on — is what turns a document into a specification somebody else can safely
# implement.
#
# Two suites, because there are two layers:
#
#   authorization — may this agent do this, now?
#   settlement    — what was agreed, what happened, and who is right?
#
# The settlement suite checks canonical hashing before it checks a single
# verdict. Two implementations that serialise a record differently compute
# different hashes, reject each other's perfectly valid chains, and each
# concludes the other's cryptography is broken. Right verdict from the wrong
# hash is agreement about nothing.
#
# A missing toolchain is skipped rather than failed: the point is to check what
# can run here, not to demand five runtimes from whoever is evaluating this.
#
#   ./check-all.sh                                  # against the live deployment
#   ./check-all.sh vectors.json settlement.json     # against local copies
set -uo pipefail
cd "$(dirname "$0")"

if [[ $# -ge 1 ]]; then
  AUTH_ARGS=(--file "$1")
  AUTH_SOURCE="$1"
else
  AUTH_ARGS=(--url "https://zakai-3uxj.vercel.app")
  AUTH_SOURCE="https://zakai-3uxj.vercel.app"
fi

if [[ $# -ge 2 ]]; then
  SETTLE_ARGS=(--file "$2")
else
  SETTLE_ARGS=("${AUTH_ARGS[@]}")
fi

failed=0
ran=0

run() {
  local name="$1" tool="$2"
  shift 2
  local -n args_ref="ARGS_CURRENT"
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '  %-8s skipped (no %s)\n' "$name" "$tool"
    return
  fi
  ran=$((ran + 1))
  if out=$("$@" "${args_ref[@]}" 2>&1); then
    printf '  %-8s %s\n' "$name" "$(echo "$out" | tail -1)"
  else
    printf '  %-8s FAILED\n%s\n' "$name" "$out"
    failed=$((failed + 1))
  fi
}

echo "authorization vectors: $AUTH_SOURCE"
ARGS_CURRENT=("${AUTH_ARGS[@]}")
run python  python3 python3 python/zakai_decide.py
run go      go      go run go/zakai_decide.go
run java    java    java java/ZakaiDecide.java
run ruby    ruby    ruby ruby/zakai_decide.rb
run php     php     php php/zakai_decide.php

echo
echo "settlement vectors:"
ARGS_CURRENT=("${SETTLE_ARGS[@]}")
run python  python3 python3 python/zakai_settle.py
run go      go      go run go/zakai_settle.go

echo
if [[ $failed -gt 0 ]]; then
  # A disagreement between implementations is the failure this exists to catch.
  # In a trust network it means one participant honouring something the others
  # refuse, which is worse than either behaviour on its own.
  echo "$failed of $ran runs disagree with the vectors."
  exit 1
fi

echo "$ran runs, all conformant."
