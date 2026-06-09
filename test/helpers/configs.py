import json
from pathlib import Path

from proxy.models.policy.flow import AppConfig


REPO_ROOT = Path(__file__).resolve().parents[2]


def materialized_default_config() -> AppConfig:
    path = REPO_ROOT / "src/proxy/defaults/default_config.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    absolutize_custom_nodes(raw)
    return AppConfig.from_dict(raw)


def absolutize_custom_nodes(raw: dict) -> dict:
    for node in raw.get("customNodes", []):
        node_path = Path(node["path"])
        if not node_path.is_absolute():
            node["path"] = str(REPO_ROOT / node_path)
    return raw
