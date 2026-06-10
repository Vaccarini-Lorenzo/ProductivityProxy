import type { AppConfig, PolicyConfig } from "../../models/config/types";

export function validateAppConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.modes.some((mode) => mode.id === config.activeModeId)) {
    errors.push("Active mode does not exist");
  }

  const policyIds = new Set(config.policies.map((policy) => policy.id));
  for (const mode of config.modes) {
    for (const id of mode.policyIds) {
      if (!policyIds.has(id)) errors.push(`Mode ${mode.name} references unknown policy ${id}`);
    }
  }

  for (const policy of config.policies) {
    errors.push(...validatePolicy(policy));
  }

  return errors;
}

function validatePolicy(policy: PolicyConfig): string[] {
  const errors: string[] = [];
  const startCount = policy.steps.filter((step) => step.kind === "node" && step.type === "start").length;
  if (startCount !== 1) {
    errors.push(`Policy ${policy.name} must have exactly one start node`);
  }

  const stepIds = new Set(policy.steps.map((step) => step.id));
  for (const edge of policy.edges) {
    if (!stepIds.has(edge.from)) errors.push(`Policy ${policy.name} has unknown edge source ${edge.from}`);
    if (!stepIds.has(edge.to)) errors.push(`Policy ${policy.name} has unknown edge target ${edge.to}`);
  }
  return errors;
}
