import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { validateAppConfig } from "@app/services/config/configValidation";

describe("validateAppConfig", () => {
  it("accepts the default config", () => {
    expect(validateAppConfig(createDefaultConfig())).toEqual([]);
  });

  it("rejects a missing active mode", () => {
    const config = createDefaultConfig();
    config.activeModeId = "missing";

    expect(validateAppConfig(config)).toContain("Active mode does not exist");
  });

  it("rejects a policy without exactly one start node", () => {
    const config = createDefaultConfig();
    config.modes[0].policies[0].steps = config.modes[0].policies[0].steps.filter((step) => step.type !== "start");

    expect(validateAppConfig(config)).toContain("Policy Productivity/Block YouTube Shorts must have exactly one start node");
  });
});
