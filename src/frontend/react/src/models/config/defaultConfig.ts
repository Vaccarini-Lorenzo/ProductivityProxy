import type { AppConfig, ModeConfig, PolicyConfig } from "./types";

function policy(id: string, name: string): PolicyConfig {
  return {
    id,
    name,
    steps: [
      { id: `${id}-start`, kind: "node", type: "start", position: { x: 80, y: 120 } },
      { id: `${id}-end`, kind: "node", type: "end", position: { x: 460, y: 120 } },
    ],
    edges: [{ from: `${id}-start`, output: "next", to: `${id}-end` }],
  };
}

function mode(id: string, name: string): ModeConfig {
  return {
    id,
    name,
    policies: [policy(`${id}-policy`, `${name} policy`)],
  };
}

export function createDefaultConfig(): AppConfig {
  return {
    activeModeId: "productivity",
    proxy: {
      port: 8080,
      allowLan: false,
      authEnabled: false,
      authUsername: "productive",
      authPassword: "change-me",
    },
    modes: [mode("productivity", "Productivity"), mode("chilling", "Chilling")],
    customNodes: [],
  };
}
