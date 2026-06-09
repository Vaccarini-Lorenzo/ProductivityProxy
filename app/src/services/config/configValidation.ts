import type { AppConfig, ModeConfig } from "../../models/config/types";

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
  const startCount = mode.graph.nodes.filter((node) => node.type === "start").length;
  if (startCount !== 1) {
    return [`Mode ${mode.name} must have exactly one start node`];
  }
  return [];
}
