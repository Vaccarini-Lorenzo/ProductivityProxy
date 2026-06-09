from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class NodeResult:
    output: str = "next"
    data: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_value(cls, value: Any) -> "NodeResult":
        if value is None:
            return cls()
        if isinstance(value, NodeResult):
            return value
        if isinstance(value, str):
            return cls(output=value)
        if isinstance(value, dict):
            return cls(
                output=str(value.get("output", "next")),
                data=dict(value.get("data", {})),
            )
        raise TypeError(f"Unsupported node result: {type(value).__name__}")
