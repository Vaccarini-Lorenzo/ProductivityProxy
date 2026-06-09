export type NodeParams = Record<string, unknown>;

export interface GraphPosition {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  type: string;
  params?: NodeParams;
  position?: GraphPosition;
}

export interface GraphEdge {
  from: string;
  output: string;
  to: string;
}

export interface PolicyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ModeConfig {
  id: string;
  name: string;
  graph: PolicyGraph;
}

export interface ProxyConfig {
  port: number;
  allowLan: boolean;
  authEnabled: boolean;
  authUsername: string;
  authPassword: string;
}

export interface CustomBlockConfig {
  id: string;
  name: string;
  path: string;
  entrypoint: string;
}

export interface AppConfig {
  activeModeId: string;
  proxy: ProxyConfig;
  modes: ModeConfig[];
  customBlocks: CustomBlockConfig[];
}
