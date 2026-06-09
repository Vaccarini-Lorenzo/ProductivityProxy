import type { GraphEdge, GraphNode, NodeParams, PolicyGraph } from "../../models/config/types";

export function addNode(graph: PolicyGraph, type: string): PolicyGraph {
  const count = graph.nodes.length;
  const col = count % 3;
  const row = Math.floor(count / 3);
  const node: GraphNode = {
    id: `${type}-${count}`,
    type,
    params: {},
    position: {
      x: 80 + col * 340,
      y: 120 + row * 160,
    },
  };
  return { ...graph, nodes: [...graph.nodes, node] };
}

export function addEdge(graph: PolicyGraph, from: string, output: string, to: string): PolicyGraph {
  const edge: GraphEdge = { from, output, to };
  return { ...graph, edges: [...graph.edges, edge] };
}

export function updateNodeParams(graph: PolicyGraph, nodeId: string, params: NodeParams): PolicyGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, params } : node)),
  };
}
