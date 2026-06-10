"""Stdin/stdout validation bridge spawned by the Tauri backend.

Input (stdin):  {"kind": "config" | "node", "payload": <config-object> | <code-string>}
Output (stdout): {"ok": bool, "issues": [<issue>, ...]}

Always exits 0 when it produced a report; a non-zero exit means the bridge
itself failed (bad input), which the Rust side surfaces as a hard error.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[3]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from proxy.services.config.validation import validate_config, validate_node_code


def main() -> int:
    request = json.loads(sys.stdin.read())
    kind = request.get("kind")
    payload = request.get("payload")

    if kind == "config":
        issues = validate_config(payload)
    elif kind == "node":
        issues = validate_node_code(str(payload))
    else:
        print(json.dumps({"error": f"unknown validation kind: {kind}"}))
        return 1

    print(json.dumps({"ok": len(issues) == 0, "issues": issues}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
