#!/usr/bin/env bash
# Run every reference implementation against the same vectors.
#
# This is the artefact, not any single implementation. Five independent
# programs, in five languages, agreeing on all nineteen cases — including the
# ones where two rules could both fire and the reason returned is what an
# integrator branches on — is what turns a document into a specification
# somebody else can safely implement.
#
# A missing toolchain is skipped rather than failed: the point is to check the
# implementations that can run here, not to demand five runtimes from whoever
# is evaluating this.
#
#   ./check-all.sh                     # against the live deployment
#   ./check-all.sh path/to/vectors.json
set -uo pipefail
cd "$(dirname "$0")"

if [[ $# -ge 1 ]]; then
  ARGS=(--file "$1")
  SOURCE="$1"
else
  ARGS=(--url "https://zakai-3uxj.vercel.app")
  SOURCE="https://zakai-3uxj.vercel.app"
fi

echo "vectors: $SOURCE"
echo

failed=0
ran=0

run() {
  local name="$1" tool="$2"
  shift 2
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '  %-8s skipped (no %s)\n' "$name" "$tool"
    return
  fi
  ran=$((ran + 1))
  if out=$("$@" "${ARGS[@]}" 2>&1); then
    printf '  %-8s %s\n' "$name" "$(echo "$out" | tail -1)"
  else
    printf '  %-8s FAILED\n%s\n' "$name" "$out"
    failed=$((failed + 1))
  fi
}

run python  python3 python3 python/zakai_decide.py
run go      go      go run go/zakai_decide.go
run java    java    java java/ZakaiDecide.java
run ruby    ruby    ruby ruby/zakai_decide.rb
run php     php     php php/zakai_decide.php

echo
if [[ $failed -gt 0 ]]; then
  echo "$failed of $ran implementations disagree with the vectors."
  # A disagreement between implementations is the failure this exists to catch.
  # In a trust network it means one participant honouring something the others
  # refuse, which is worse than either behaviour on its own.
  exit 1
fi

echo "$ran implementations, all conformant."
