"""
Shim — import from the official package:

  from zakai_mandate import verify_status_list_from_url
"""

from __future__ import annotations

import sys
from pathlib import Path

_SDK_SRC = Path(__file__).resolve().parents[2] / "sdk" / "python" / "src"
if _SDK_SRC.is_dir():
    sys.path.insert(0, str(_SDK_SRC))

from zakai_mandate.jws import *  # noqa: E402,F403
from zakai_mandate.jws import HAS_CRYPTO, JwsError  # noqa: E402
