import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";

function startSteps(modeId: string) {
  const config = createDefaultConfig();
  const mode = config.modes.find((item) => item.id === modeId);
  const policyId = mode?.policyIds[0];
  const policy = config.policies.find((item) => item.id === policyId);
  return policy?.steps.filter((step) => step.kind === "node" && step.type === "start") ?? [];
}

describe("createDefaultConfig", () => {
  it("creates productivity and chilling modes", () => {
    const config = createDefaultConfig();

    expect(config.activeModeId).toBe("productivity");
    expect(config.modes.map((mode) => mode.id)).toEqual(["productivity", "chilling"]);
    expect(config.modes.every((mode) => mode.createFriction === false)).toBe(true);
    expect(config.modes.every((mode) => mode.defaultTime === null)).toBe(true);
  });

  it("creates one start node per default mode policy", () => {
    expect(startSteps("productivity")).toHaveLength(1);
  });

  it("leaves the chilling mode empty so it allows all traffic", () => {
    const config = createDefaultConfig();
    const chilling = config.modes.find((mode) => mode.id === "chilling");
    expect(chilling?.policyIds).toEqual([]);
  });

  it("uses local-only unauthenticated proxy by default", () => {
    const config = createDefaultConfig();

    expect(config.proxy.port).toBe(8080);
    expect(config.proxy.allowLan).toBe(false);
    expect(config.proxy.authEnabled).toBe(false);
    expect(config.proxy.localRoutingMode).toBe("systemWide");
    expect(config.proxy.appCaptureTargets).toEqual([]);
  });
});
