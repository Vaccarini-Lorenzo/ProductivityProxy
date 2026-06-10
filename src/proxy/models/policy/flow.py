from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

BUILTIN_NODE_TYPES = {"start", "end"}
OPERATOR_TYPES = {"if", "switch"}


@dataclass(frozen=True)
class PolicyStep:
    id: str
    kind: str
    type: str
    params: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PolicyStep":
        return cls(
            id=str(raw["id"]),
            kind=str(raw.get("kind", "node")),
            type=str(raw["type"]),
            params=dict(raw.get("params", {})),
        )


@dataclass(frozen=True)
class PolicyEdge:
    from_id: str
    output: str
    to_id: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PolicyEdge":
        return cls(
            from_id=str(raw["from"]),
            output=str(raw.get("output", "next")),
            to_id=str(raw["to"]),
        )


@dataclass(frozen=True)
class Policy:
    id: str
    name: str
    steps: list[PolicyStep]
    edges: list[PolicyEdge]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Policy":
        policy = cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            steps=[PolicyStep.from_dict(item) for item in raw.get("steps", [])],
            edges=[PolicyEdge.from_dict(item) for item in raw.get("edges", [])],
        )
        policy.validate_structure()
        return policy

    def validate_structure(self) -> None:
        _require_unique([step.id for step in self.steps], "policy step")
        starts = [step for step in self.steps if step.kind == "node" and step.type == "start"]
        if len(starts) != 1:
            raise ValueError(f"Policy {self.id} must contain exactly one start node")

        step_ids = {step.id for step in self.steps}
        routes = set()
        for edge in self.edges:
            if edge.from_id not in step_ids:
                raise ValueError(f"Unknown edge source: {edge.from_id}")
            if edge.to_id not in step_ids:
                raise ValueError(f"Unknown edge target: {edge.to_id}")
            route = (edge.from_id, edge.output)
            if route in routes:
                raise ValueError(f"Duplicate route: {edge.from_id} -> {edge.output}")
            routes.add(route)

    def start_step(self) -> PolicyStep:
        for step in self.steps:
            if step.kind == "node" and step.type == "start":
                return step
        raise ValueError(f"Policy {self.id} has no start node")

    def step_by_id(self, step_id: str) -> PolicyStep:
        for step in self.steps:
            if step.id == step_id:
                return step
        raise ValueError(f"Unknown policy step: {step_id}")

    def next_step_id(self, current_id: str, output: str) -> str | None:
        for edge in self.edges:
            if edge.from_id == current_id and edge.output == output:
                return edge.to_id
        return None


@dataclass(frozen=True)
class Mode:
    id: str
    name: str
    policy_ids: list[str]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Mode":
        mode = cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            policy_ids=[str(pid) for pid in raw.get("policyIds", [])],
        )
        _require_unique(mode.policy_ids, "policy reference")
        return mode


@dataclass(frozen=True)
class CustomNode:
    id: str
    name: str
    path: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CustomNode":
        path = str(raw["path"])
        if not Path(path).is_absolute():
            raise ValueError(f"Custom node path must be absolute: {path}")
        return cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            path=path,
        )


@dataclass(frozen=True)
class AppConfig:
    active_mode_id: str
    modes: list[Mode]
    policies: list[Policy]
    custom_nodes: list[CustomNode]
    proxy: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AppConfig":
        config = cls(
            active_mode_id=str(raw["activeModeId"]),
            proxy=dict(raw.get("proxy", {})),
            policies=[Policy.from_dict(item) for item in raw.get("policies", [])],
            modes=[Mode.from_dict(item) for item in raw.get("modes", [])],
            custom_nodes=[CustomNode.from_dict(item) for item in raw.get("customNodes", [])],
        )
        config.validate()
        return config

    def validate(self) -> None:
        _require_unique([mode.id for mode in self.modes], "mode")
        _require_unique([policy.id for policy in self.policies], "policy")
        _require_unique([node.id for node in self.custom_nodes], "custom node")
        self.active_mode()
        policy_ids = {policy.id for policy in self.policies}
        for mode in self.modes:
            for pid in mode.policy_ids:
                if pid not in policy_ids:
                    raise ValueError(f"Mode {mode.id} references unknown policy: {pid}")
        custom_node_ids = {node.id for node in self.custom_nodes}
        for policy in self.policies:
            for step in policy.steps:
                _validate_step_type(step, custom_node_ids)

    def active_mode(self) -> Mode:
        for mode in self.modes:
            if mode.id == self.active_mode_id:
                return mode
        raise ValueError(f"Unknown active mode: {self.active_mode_id}")

    def policy_by_id(self, policy_id: str) -> Policy:
        for policy in self.policies:
            if policy.id == policy_id:
                return policy
        raise ValueError(f"Unknown policy: {policy_id}")

    def active_policies(self) -> list[Policy]:
        return [self.policy_by_id(pid) for pid in self.active_mode().policy_ids]

    def custom_node(self, node_id: str) -> CustomNode:
        for node in self.custom_nodes:
            if node.id == node_id:
                return node
        raise ValueError(f"Unknown custom node: {node_id}")


def _validate_step_type(step: PolicyStep, custom_node_ids: set[str]) -> None:
    if step.kind == "node":
        if step.type not in BUILTIN_NODE_TYPES and step.type not in custom_node_ids:
            raise ValueError(f"Unknown node type: {step.type}")
        return
    if step.kind == "operator":
        if step.type not in OPERATOR_TYPES:
            raise ValueError(f"Unknown operator type: {step.type}")
        return
    raise ValueError(f"Unknown policy step kind: {step.kind}")


def _require_unique(values: list[str], label: str) -> None:
    seen = set()
    for value in values:
        if value in seen:
            raise ValueError(f"Duplicate {label}: {value}")
        seen.add(value)
