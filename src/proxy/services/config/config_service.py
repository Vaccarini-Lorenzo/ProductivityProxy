from __future__ import annotations

import json
from pathlib import Path

from proxy.models.policy.flow import AppConfig

BUILTIN_NODE_PATHS = {
    "block-response": "block_response.py",
    "track-time": "track_time.py",
    "is-usage-over-limit": "is_usage_over_limit.py",
}


class ConfigService:
    def __init__(self, path: Path):
        self.path = Path(path)

    def load(self) -> AppConfig:
        with self.path.open("r", encoding="utf-8") as file:
            raw = json.load(file)
        _normalize_builtin_node_paths(raw)
        return AppConfig.from_dict(raw)


def _normalize_builtin_node_paths(raw: dict) -> None:
    nodes = raw.get("customNodes")
    if not isinstance(nodes, list):
        return
    defaults_dir = Path(__file__).resolve().parents[3] / "proxy/defaults/nodes"
    for node in nodes:
        if not isinstance(node, dict):
            continue
        file_name = BUILTIN_NODE_PATHS.get(str(node.get("id", "")))
        if file_name:
            node["path"] = str(defaults_dir / file_name)
