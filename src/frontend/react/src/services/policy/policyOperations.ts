import type { PolicyConfig, PolicyStep, PolicyStepKind, StepParams } from "../../models/config/types";
import { defaultNodeParams } from "../nodes/nodeParams";
import { IF_CONDITION_CODE, START_TRIGGER_CODE, SWITCH_CONDITION_CODE } from "./codeTemplates";

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

export function updateStepParams(policy: PolicyConfig, stepId: string, params: StepParams): PolicyConfig {
  return {
    ...policy,
    steps: policy.steps.map((step) => (step.id === stepId ? { ...step, params } : step)),
  };
}

function defaultParams(kind: PolicyStepKind, type: string): StepParams {
  if (kind === "operator") {
    if (type === "if") return { code: IF_CONDITION_CODE };
    return { code: SWITCH_CONDITION_CODE, cases: ["case_a", "case_b", "case_c", "default"] };
  }
  if (type === "start") return { code: START_TRIGGER_CODE };
  return defaultNodeParams(type);
}
