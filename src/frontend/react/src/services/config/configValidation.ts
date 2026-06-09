import type { AppConfig, ModeConfig, PolicyConfig } from "../../models/config/types";

export function validateAppConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.modes.some((mode) => mode.id === config.activeModeId)) {
    errors.push("Active mode does not exist");
  }

  for (const mode of config.modes) {
    errors.push(...validateMode(mode));
  }

  return errors;
}

function validateMode(mode: ModeConfig): string[] {
  return mode.policies.flatMap((policy) => validatePolicy(mode, policy));
}

function validatePolicy(mode: ModeConfig, policy: PolicyConfig): string[] {
  const errors: string[] = [];
  const startCount = policy.steps.filter((step) => step.kind === "node" && step.type === "start").length;
  if (startCount !== 1) {
    errors.push(`Policy ${mode.name}/${policy.name} must have exactly one start node`);
  }

  const stepIds = new Set(policy.steps.map((step) => step.id));
  for (const edge of policy.edges) {
    if (!stepIds.has(edge.from)) errors.push(`Policy ${policy.name} has unknown edge source ${edge.from}`);
    if (!stepIds.has(edge.to)) errors.push(`Policy ${policy.name} has unknown edge target ${edge.to}`);
  }
  return errors;
}
