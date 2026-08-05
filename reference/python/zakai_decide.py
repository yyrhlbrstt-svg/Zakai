#!/usr/bin/env python3
"""
Shim — prefer sdk/python:

  PYTHONPATH=sdk/python/src python -m zakai_mandate.decide --url https://zakai-3uxj.vercel.app
"""

from __future__ import annotations

import sys
from pathlib import Path

_SDK_SRC = Path(__file__).resolve().parents[2] / "sdk" / "python" / "src"
if _SDK_SRC.is_dir():
    sys.path.insert(0, str(_SDK_SRC))

from zakai_mandate.decide import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
