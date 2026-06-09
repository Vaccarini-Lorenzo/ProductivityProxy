import { describe, expect, it } from "vitest";

import type { PolicyGraph } from "@app/models/config/types";
import { addEdge, addNode, updateNodeParams } from "@app/services/graph/graphOperations";

function graph(): PolicyGraph {
  return {
    nodes: [{ id: "start", type: "start" }],
    edges: [],
  };
}

describe("graphOperations", () => {
  it("adds a node with deterministic id and default position", () => {
    const updated = addNode(graph(), "log");

    expect(updated.nodes[1]).toEqual({
      id: "log-1",
      type: "log",
      params: {},
      position: { x: 280, y: 120 },
    });
  });

  it("adds an edge with output", () => {
    const updated = addEdge(graph(), "start", "next", "log-1");

    expect(updated.edges).toEqual([{ from: "start", output: "next", to: "log-1" }]);
  });

  it("updates node params immutably", () => {
    const original = addNode(graph(), "block");
    const updated = updateNodeParams(original, "block-1", { message: "Blocked" });

    expect(updated.nodes.find((node) => node.id === "block-1")?.params).toEqual({ message: "Blocked" });
    expect(original.nodes.find((node) => node.id === "block-1")?.params).toEqual({});
  });
});
