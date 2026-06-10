from __future__ import annotations

from typing import Any

from proxy.models.policy.flow import PolicyStep


def compile_callable(code: str, func_name: str, extra_globals: dict[str, Any] | None = None):
    """Compile inline policy code once and return its named function.

    The function keeps a reference to its globals namespace, so the returned
    callable can be reused across requests without recompiling the source.
    """
    namespace: dict[str, Any] = dict(extra_globals or {})
    exec(compile(code, f"<{func_name}>", "exec"), namespace)
    function = namespace.get(func_name)
    if not callable(function):
        raise ValueError(f"code must define {func_name}(input)")
    return function


class OperatorRunner:
    """Operators are described by inline Python code.

    - if:     def if_condition(input) -> bool      (routes to "then" / "else")
    - switch: def switch_condition(input) -> str   (routes to the returned label)

    Compiled functions are cached per (code, function) so the source is compiled
    once instead of on every request.
    """

    def __init__(self):
        self._cache: dict[tuple[str, str], Any] = {}

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
        key = (str(code), function_name)
        function = self._cache.get(key)
        if function is None:
            function = compile_callable(str(code), function_name)
            self._cache[key] = function
        return function(input_value)
