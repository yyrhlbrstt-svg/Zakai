#!/usr/bin/env python3
"""
Shim — prefer the official package under sdk/python:

  pip install -e 'sdk/python[crypto]'
  zakai-mandate-ready --origin https://zakai-3uxj.vercel.app

This path stays for older docs and copy-paste until teams migrate.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SDK_SRC = Path(__file__).resolve().parents[2] / "sdk" / "python" / "src"
if _SDK_SRC.is_dir():
    sys.path.insert(0, str(_SDK_SRC))

from zakai_mandate.verify import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
