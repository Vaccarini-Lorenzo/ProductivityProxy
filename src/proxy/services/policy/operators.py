from __future__ import annotations

from typing import Any

from proxy.models.policy.flow import PolicyStep


class OperatorRunner:
    """Operators are described by inline Python code.

    - if:     def if_condition(input) -> bool      (routes to "then" / "else")
    - switch: def switch_condition(input) -> str   (routes to the returned label)
    """

    def evaluate(self, step: PolicyStep, input_value: Any) -> str:
        if step.type == "if":
            return "then" if bool(self._call(step, "if_condition", input_value)) else "else"
        if step.type == "switch":
            return str(self._call(step, "switch_condition", input_value))
        raise ValueError(f"Unknown operator type: {step.type}")

    def _call(self, step: PolicyStep, function_name: str, input_value: Any) -> Any:
        code = step.params.get("code")
        if not code:
            raise ValueError(f"Operator '{step.id}' is missing code")
        namespace: dict[str, Any] = {}
        exec(str(code), namespace)
        function = namespace.get(function_name)
        if not callable(function):
            raise ValueError(f"Operator '{step.id}' must define {function_name}(input)")
        return function(input_value)
