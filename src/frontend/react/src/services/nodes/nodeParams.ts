import type { PolicyStep, StepParams } from "../../models/config/types";
import nodeParamSpecs from "../../../../../proxy/defaults/node_params.json";

type NodeParamSpec = { params?: Record<string, { type?: string; default: unknown }> };
const DEFAULT_NODE_PARAMS = nodeParamSpecs as Record<string, NodeParamSpec>;

export function defaultNodeParams(type: string): StepParams {
  const params = DEFAULT_NODE_PARAMS[type]?.params;
  if (!params) return {};
  return Object.fromEntries(Object.entries(params).map(([key, spec]) => [key, spec.default]));
}

export function paramsWithDefaults(step: PolicyStep): StepParams {
  return { ...defaultNodeParams(step.type), ...step.params };
}

export function paramInputType(type: string, key: string): string {
  return DEFAULT_NODE_PARAMS[type]?.params?.[key]?.type === "number" ? "number" : "text";
}
