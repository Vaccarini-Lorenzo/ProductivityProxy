import type { AppConfig, ModeConfig } from "./types";

function mode(id: string, name: string): ModeConfig {
  return {
    id,
    name,
    graph: {
      nodes: [
        { id: `${id}-start`, type: "start", position: { x: 80, y: 120 } },
        { id: `${id}-end`, type: "end", position: { x: 460, y: 120 } },
      ],
      edges: [{ from: `${id}-start`, output: "next", to: `${id}-end` }],
    },
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
    customBlocks: [],
  };
}
