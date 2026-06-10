import type { PolicyConfig, PolicyEdge, PolicyStep, PolicyStepKind, StepParams } from "../../models/config/types";
import nodeParamSpecs from "../../../../../proxy/defaults/node_params.json";

type NodeParamSpec = { params?: Record<string, { default: unknown }> };
const DEFAULT_NODE_PARAMS = nodeParamSpecs as Record<string, NodeParamSpec>;

const DEFAULT_START_TRIGGER_CODE = `def triggered_by(request: Request) -> bool:
    return True
`;

export function addStep(policy: PolicyConfig, kind: PolicyStepKind, type: string, params?: StepParams): PolicyConfig {
  const count = policy.steps.length;
  const col = count % 3;
  const row = Math.floor(count / 3);
  const step: PolicyStep = {
    id: `${type}-${count}`,
    kind,
    type,
    params: params ?? defaultParams(kind, type),
    position: {
      x: 80 + col * 340,
      y: 120 + row * 160,
    },
  };
  return { ...policy, steps: [...policy.steps, step] };
}

export function addEdge(policy: PolicyConfig, from: string, output: string, to: string): PolicyConfig {
  const edge: PolicyEdge = { from, output, to };
  return { ...policy, edges: [...policy.edges, edge] };
}

export function updateStepParams(policy: PolicyConfig, stepId: string, params: StepParams): PolicyConfig {
  return {
    ...policy,
    steps: policy.steps.map((step) => (step.id === stepId ? { ...step, params } : step)),
  };
}

export function updateEdgeOutput(policy: PolicyConfig, index: number, output: string): PolicyConfig {
  return {
    ...policy,
    edges: policy.edges.map((edge, edgeIndex) => (edgeIndex === index ? { ...edge, output } : edge)),
  };
}

function defaultParams(kind: PolicyStepKind, type: string): StepParams {
  if (kind === "operator") {
    if (type === "if") return { code: "def if_condition(input) -> bool:\n    return False\n" };
    return { code: 'def switch_condition(input) -> str:\n    return "default"\n', cases: ["case_a", "case_b", "case_c", "default"] };
  }
  if (type === "start") return { code: DEFAULT_START_TRIGGER_CODE };
  return defaultNodeParams(type);
}

function defaultNodeParams(type: string): StepParams {
  const params = DEFAULT_NODE_PARAMS[type]?.params;
  if (!params) return {};
  return Object.fromEntries(Object.entries(params).map(([key, spec]) => [key, spec.default]));
}
