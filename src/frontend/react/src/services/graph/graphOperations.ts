import type { GraphEdge, GraphNode, NodeParams, PolicyGraph } from "../../models/config/types";

export function addNode(graph: PolicyGraph, type: string): PolicyGraph {
  const node: GraphNode = {
    id: `${type}-${graph.nodes.length}`,
    type,
    params: {},
    position: {
      x: 160 + graph.nodes.length * 120,
      y: 120,
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
