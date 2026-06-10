from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path
from typing import Any

from proxy.models.policy.flow import AppConfig, PolicyStep


class CustomNodeRunner:
    def __init__(self, config: AppConfig):
        self.config = config
        self._modules: dict[str, Any] = {}

    def run(self, step: PolicyStep, input_value: Any, context) -> Any:
        custom_node = self.config.custom_node(step.type)
        module = self._module_for(Path(custom_node.path))
        run_function = getattr(module, "run")
        return run_function(input_value, context, dict(step.params))

    def _module_for(self, path: Path):
        key = str(path)
        if key not in self._modules:
            self._modules[key] = self._load_module(path)
        return self._modules[key]

    def _load_module(self, path: Path):
        if not path.is_absolute():
            raise ValueError(f"Custom node path must be absolute: {path}")
        module_name = f"productivity_proxy_custom_{uuid.uuid4().hex}"
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            raise ValueError(f"Cannot load custom node: {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
