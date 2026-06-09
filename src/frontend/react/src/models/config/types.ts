export type StepParams = Record<string, unknown>;

export interface GraphPosition {
  x: number;
  y: number;
}

export type PolicyStepKind = "node" | "operator";

export interface PolicyStep {
  id: string;
  kind: PolicyStepKind;
  type: string;
  params?: StepParams;
  position?: GraphPosition;
}

export interface PolicyEdge {
  from: string;
  output: string;
  to: string;
}

export interface PolicyConfig {
  id: string;
  name: string;
  steps: PolicyStep[];
  edges: PolicyEdge[];
}

export interface ModeConfig {
  id: string;
  name: string;
  description?: string;
  policies: PolicyConfig[];
}

export interface ProxyConfig {
  port: number;
  allowLan: boolean;
  authEnabled: boolean;
  authUsername: string;
  authPassword: string;
}

export interface CustomNodeConfig {
  id: string;
  name: string;
  path: string;
}

export interface AppConfig {
  activeModeId: string;
  proxy: ProxyConfig;
  modes: ModeConfig[];
  customNodes: CustomNodeConfig[];
}
