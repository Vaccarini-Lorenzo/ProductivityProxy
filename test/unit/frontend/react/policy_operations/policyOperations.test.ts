import { describe, expect, it } from "vitest";

import type { PolicyConfig } from "@app/models/config/types";
import { addEdge, addStep, updateEdgeOutput, updateStepParams } from "@app/services/policy/policyOperations";

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

  it("adds an edge with output", () => {
    const updated = addEdge(policy(), "start", "next", "log-event-1");

    expect(updated.edges).toEqual([{ from: "start", output: "next", to: "log-event-1" }]);
  });

  it("updates step params immutably", () => {
    const original = addStep(policy(), "node", "block-response");
    const updated = updateStepParams(original, "block-response-1", { message: "Blocked" });

    expect(updated.steps.find((step) => step.id === "block-response-1")?.params).toEqual({ message: "Blocked" });
    expect(original.steps.find((step) => step.id === "block-response-1")?.params).toEqual({ status: 403, message: "Blocked" });
  });

  it("updates edge outputs", () => {
    const original = addEdge(policy(), "choice", "next", "end");
    const updated = updateEdgeOutput(original, 0, "true");

    expect(updated.edges[0].output).toBe("true");
  });
});
