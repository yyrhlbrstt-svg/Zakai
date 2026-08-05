#!/usr/bin/env python3
"""
Zero-friction Python gate — from sdk/python:

  pip install -e '.[crypto]'
  python examples/ready.py
  python examples/ready.py --origin https://zakai-3uxj.vercel.app

Prefer: zakai-mandate-ready  (same entrypoint)
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(ROOT))

from zakai_mandate.verify import main  # noqa: E402

if __name__ == "__main__":
    # Default to --ready when no flags (same as zakai-mandate-ready).
    if len(sys.argv) == 1:
        sys.argv.append("--ready")
    raise SystemExit(main())
