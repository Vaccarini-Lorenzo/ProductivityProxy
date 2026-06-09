from __future__ import annotations

from typing import Any

from proxy.models.policy.flow import PolicyStep


class OperatorRunner:
    def evaluate(self, step: PolicyStep, input_value: Any) -> str:
        if step.type == "if":
            return self._if(step, input_value)
        if step.type == "switch":
            return self._switch(step, input_value)
        raise ValueError(f"Unknown operator type: {step.type}")

    def _if(self, step: PolicyStep, input_value: Any) -> str:
        value = _get_path(input_value, str(step.params["path"]))
        return "true" if bool(value) else "false"

    def _switch(self, step: PolicyStep, input_value: Any) -> str:
        value = _get_path(input_value, str(step.params["path"]))
        if value is None:
            return "default"
        return str(value)


def _get_path(value: Any, path: str) -> Any:
    current = value
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current
