#!/usr/bin/env bash
# Prepare zakai-packs/ as a standalone git repo (no node_modules).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/zakai-packs"
DEST="${1:-$ROOT/../zakai-packs-export}"

if [[ ! -d "$SRC/packs" ]]; then
  echo "Missing $SRC/packs — run from Zakai monorepo." >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
tar -C "$SRC" \
  --exclude=node_modules \
  --exclude=.git \
  -cf - . | tar -C "$DEST" -xf -

cd "$DEST"
if [[ ! -d .git ]]; then
  git init -b main
  git config user.email "packs-ci@zakai.app"
  git config user.name "Zakai Packs CI"
  git add .
  git commit -m "Initial zakai-packs export from Zakai monorepo"
fi

echo ""
echo "Standalone tree ready at: $DEST"
echo "Add remote and push, e.g.:"
echo "  cd \"$DEST\""
echo "  git remote add origin git@github.com:YOUR_ORG/zakai-packs.git"
echo "  git push -u origin main"
