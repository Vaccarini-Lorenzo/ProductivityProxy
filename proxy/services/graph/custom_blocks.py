from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path

from proxy.models.graph.policy_graph import AppConfig, GraphNode
from proxy.models.runtime.result import NodeResult


REPO_ROOT = Path(__file__).resolve().parents[3]


class CustomBlockRunner:
    def __init__(self, config: AppConfig):
        self.config = config

    def run(self, node: GraphNode, context) -> NodeResult:
        block_id = str(node.params["blockId"])
        block = self.config.custom_block(block_id)
        module = self._load_module(self._resolve_path(Path(block.path)))
        entrypoint = getattr(module, block.entrypoint)
        return NodeResult.from_value(entrypoint(context, dict(node.params)))

    def _resolve_path(self, path: Path) -> Path:
        if path.is_absolute():
            return path
        return REPO_ROOT / path

    def _load_module(self, path: Path):
        module_name = f"productive_proxy_custom_{uuid.uuid4().hex}"
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            raise ValueError(f"Cannot load custom block: {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
