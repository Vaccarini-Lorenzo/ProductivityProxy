from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from proxy.services.config.validation import validate_config


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
        return cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            steps=[PolicyStep.from_dict(item) for item in raw.get("steps", [])],
            edges=[PolicyEdge.from_dict(item) for item in raw.get("edges", [])],
        )

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
        return cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            policy_ids=[str(pid) for pid in raw.get("policyIds", [])],
        )


@dataclass(frozen=True)
class CustomNode:
    id: str
    name: str
    path: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CustomNode":
        return cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            path=str(raw["path"]),
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
        issues = validate_config(raw)
        if issues:
            raise ValueError("; ".join(issue["message"] for issue in issues))
        return cls(
            active_mode_id=str(raw["activeModeId"]),
            proxy=dict(raw.get("proxy", {})),
            policies=[Policy.from_dict(item) for item in raw.get("policies", [])],
            modes=[Mode.from_dict(item) for item in raw.get("modes", [])],
            custom_nodes=[CustomNode.from_dict(item) for item in raw.get("customNodes", [])],
        )

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
