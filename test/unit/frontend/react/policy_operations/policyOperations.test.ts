import { describe, expect, it } from "vitest";

import type { PolicyConfig } from "@app/models/config/types";
import { addStep, updateStepParams } from "@app/services/policy/policyOperations";

function policy(): PolicyConfig {
  return {
    id: "policy",
    name: "Policy",
    steps: [{ id: "start", kind: "node", type: "start" }],
    edges: [],
  };
}

describe("policyOperations", () => {
  it("adds a step with deterministic id and default position", () => {
    const updated = addStep(policy(), "node", "log-event");

    expect(updated.steps[1]).toEqual({
      id: "log-event-1",
      kind: "node",
      type: "log-event",
      params: {},
      position: { x: 420, y: 120 },
    });
  });

  it("adds registered node params from the default spec", () => {
    const updated = addStep(policy(), "node", "track-time");

    expect(updated.steps[1].params).toEqual({ platform: "reddit", idleSeconds: 300 });
  });

  it("updates step params immutably", () => {
    const original = addStep(policy(), "node", "block-response");
    const updated = updateStepParams(original, "block-response-1", { message: "Blocked" });

    expect(updated.steps.find((step) => step.id === "block-response-1")?.params).toEqual({ message: "Blocked" });
    expect(original.steps.find((step) => step.id === "block-response-1")?.params).toEqual({ status: 403, message: "Blocked" });
  });

});
