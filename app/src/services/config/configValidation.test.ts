import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "../../models/config/defaultConfig";
import { validateAppConfig } from "./configValidation";

describe("validateAppConfig", () => {
  it("accepts the default config", () => {
    expect(validateAppConfig(createDefaultConfig())).toEqual([]);
  });

  it("rejects a missing active mode", () => {
    const config = createDefaultConfig();
    config.activeModeId = "missing";

    expect(validateAppConfig(config)).toContain("Active mode does not exist");
  });

  it("rejects a graph without exactly one start node", () => {
    const config = createDefaultConfig();
    config.modes[0].graph.nodes = config.modes[0].graph.nodes.filter((node) => node.type !== "start");

    expect(validateAppConfig(config)).toContain("Mode Productivity must have exactly one start node");
  });
});
