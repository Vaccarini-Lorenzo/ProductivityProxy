import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";

function startNodes(modeId: string) {
  const config = createDefaultConfig();
  const mode = config.modes.find((item) => item.id === modeId);
  return mode?.graph.nodes.filter((node) => node.type === "start") ?? [];
}

describe("createDefaultConfig", () => {
  it("creates productivity and chilling modes", () => {
    const config = createDefaultConfig();

    expect(config.activeModeId).toBe("productivity");
    expect(config.modes.map((mode) => mode.id)).toEqual(["productivity", "chilling"]);
  });

  it("creates one start node per default mode", () => {
    expect(startNodes("productivity")).toHaveLength(1);
    expect(startNodes("chilling")).toHaveLength(1);
  });

  it("uses local-only unauthenticated proxy by default", () => {
    const config = createDefaultConfig();

    expect(config.proxy.port).toBe(8080);
    expect(config.proxy.allowLan).toBe(false);
    expect(config.proxy.authEnabled).toBe(false);
  });
});
