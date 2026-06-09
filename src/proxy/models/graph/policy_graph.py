from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class GraphNode:
    id: str
    type: str
    params: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "GraphNode":
        return cls(
            id=str(raw["id"]),
            type=str(raw["type"]),
            params=dict(raw.get("params", {})),
        )


@dataclass(frozen=True)
class GraphEdge:
    from_id: str
    output: str
    to_id: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "GraphEdge":
        return cls(
            from_id=str(raw["from"]),
            output=str(raw.get("output", "next")),
            to_id=str(raw["to"]),
        )


@dataclass(frozen=True)
class PolicyGraph:
    nodes: list[GraphNode]
    edges: list[GraphEdge]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PolicyGraph":
        graph = cls(
            nodes=[GraphNode.from_dict(item) for item in raw.get("nodes", [])],
            edges=[GraphEdge.from_dict(item) for item in raw.get("edges", [])],
        )
        graph.start_node()
        return graph

    def node_by_id(self, node_id: str) -> GraphNode:
        for node in self.nodes:
            if node.id == node_id:
                return node
        raise ValueError(f"Unknown graph node: {node_id}")

    def start_node(self) -> GraphNode:
        starts = [node for node in self.nodes if node.type == "start"]
        if len(starts) != 1:
            raise ValueError("A graph must contain exactly one start node")
        return starts[0]

    def next_node_id(self, current_id: str, output: str) -> str | None:
        fallback = None
        for edge in self.edges:
            if edge.from_id != current_id:
                continue
            if edge.output == output:
                return edge.to_id
            if edge.output == "*":
                fallback = edge.to_id
        return fallback


@dataclass(frozen=True)
class Mode:
    id: str
    name: str
    graph: PolicyGraph

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Mode":
        return cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            graph=PolicyGraph.from_dict(raw.get("graph", {})),
        )


@dataclass(frozen=True)
class CustomBlock:
    id: str
    name: str
    path: str
    entrypoint: str = "run"

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CustomBlock":
        return cls(
            id=str(raw["id"]),
            name=str(raw.get("name", raw["id"])),
            path=str(raw["path"]),
            entrypoint=str(raw.get("entrypoint", "run")),
        )


@dataclass(frozen=True)
class AppConfig:
    active_mode_id: str
    modes: list[Mode]
    custom_blocks: list[CustomBlock]
    proxy: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AppConfig":
        config = cls(
            active_mode_id=str(raw["activeModeId"]),
            proxy=dict(raw.get("proxy", {})),
            modes=[Mode.from_dict(item) for item in raw.get("modes", [])],
            custom_blocks=[CustomBlock.from_dict(item) for item in raw.get("customBlocks", [])],
        )
        config.active_mode()
        return config

    def active_mode(self) -> Mode:
        for mode in self.modes:
            if mode.id == self.active_mode_id:
                return mode
        raise ValueError(f"Unknown active mode: {self.active_mode_id}")

    def custom_block(self, block_id: str) -> CustomBlock:
        for block in self.custom_blocks:
            if block.id == block_id:
                return block
        raise ValueError(f"Unknown custom block: {block_id}")
