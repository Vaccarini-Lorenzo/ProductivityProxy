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
  policyIds: string[];
}

export type LocalRoutingMode = "systemWide" | "appSpecific";
export type AppCaptureTarget = string;

export interface ProxyConfig {
  port: number;
  allowLan: boolean;
  authEnabled: boolean;
  authUsername: string;
  authPassword: string;
  localRoutingMode: LocalRoutingMode;
  appCaptureTargets: AppCaptureTarget[];
}

export interface CustomNodeConfig {
  id: string;
  name: string;
  path: string;
}

export type ValidationScope = "global" | "policy" | "node";

export interface ValidationIssue {
  scope: ValidationScope;
  policyId: string | null;
  nodeId: string | null;
  stepIds: string[];
  message: string;
  hint: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface AppConfig {
  activeModeId: string;
  proxy: ProxyConfig;
  modes: ModeConfig[];
  policies: PolicyConfig[];
  customNodes: CustomNodeConfig[];
}
